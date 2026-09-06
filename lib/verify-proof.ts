import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { GITHUB_REPO_WEB } from "./repo";

// Runs the OpenTimestamps proof for a chapter and returns a plain-language,
// fully-transparent result — so the site can show a normal reader "yes, this is
// real" without them touching a CLI, while still printing every hash so a
// skeptic can re-check each step independently.
//
// The proof is two independent links, and we verify BOTH:
//   1. file  → its SHA-256 fingerprint == the hash the .ots commits to
//      (proves the proof is for THIS exact chapter, unchanged)
//   2. .ots  → resolves to a Bitcoin block's merkle root == the real block's
//      merkle root from a public explorer (proves it's anchored in that block)

export type ProofVerification = {
  ok: boolean; // both checks passed
  fileMatches: boolean; // check 1
  rootMatches: boolean | null; // check 2 (null = explorer unreachable)
  fileHash: string | null; // sha256 of the chapter file
  otsFileHash: string | null; // hash the .ots commits to
  block: number | null;
  blockHash: string | null;
  blockTime: number | null; // unix seconds (UTC)
  otsMerkleRoot: string | null;
  blockMerkleRoot: string | null;
  rawFileUrl: string;
  otsUrl: string | null;
  error?: string;
};

function reverseHex(h: string): string {
  return (h.match(/../g) || []).reverse().join("");
}

function rawUrl(slug: string): string {
  const raw = GITHUB_REPO_WEB.replace("github.com", "raw.githubusercontent.com");
  return `${raw}/main/chapters/${slug}.md`;
}

export async function verifyChapterProof(slug: string): Promise<ProofVerification> {
  const rawFileUrl = rawUrl(slug);
  const otsAbs = path.join(process.cwd(), "public", "proofs", "ots", `${slug}.ots`);
  const base: ProofVerification = {
    ok: false,
    fileMatches: false,
    rootMatches: null,
    fileHash: null,
    otsFileHash: null,
    block: null,
    blockHash: null,
    blockTime: null,
    otsMerkleRoot: null,
    blockMerkleRoot: null,
    rawFileUrl,
    otsUrl: fs.existsSync(otsAbs) ? `/proofs/ots/${slug}.ots` : null,
  };

  if (!fs.existsSync(otsAbs)) return { ...base, error: "No timestamp proof for this chapter yet." };

  // Parse the .ots: the committed file hash + the earliest confirmed block.
  let otsFileHash: string | null = null;
  let block: number | null = null;
  let otsMerkleRoot: string | null = null;
  try {
    const otsMod = await import("opentimestamps");
    const OTS = (otsMod as unknown as { default?: unknown }).default ?? otsMod;
    const O = OTS as {
      DetachedTimestampFile: { deserialize: (b: Uint8Array) => unknown };
      info: (d: unknown) => string;
    };
    const detached = O.DetachedTimestampFile.deserialize(new Uint8Array(fs.readFileSync(otsAbs)));
    const info = O.info(detached);
    otsFileHash = (info.match(/File sha256 hash:\s*([0-9a-f]+)/i)?.[1] || null)?.toLowerCase() ?? null;
    const pairs = [
      ...info.matchAll(
        /BitcoinBlockHeaderAttestation\((\d+)\)\s*\n\s*#\s*Bitcoin block merkle root\s+([0-9a-f]+)/gi
      ),
    ].map((m) => ({ height: Number(m[1]), root: m[2].toLowerCase() }));
    if (pairs.length) {
      pairs.sort((a, b) => a.height - b.height); // earliest = tightest bound
      block = pairs[0].height;
      otsMerkleRoot = pairs[0].root;
    }
  } catch (e) {
    return { ...base, error: `Couldn't read the proof: ${e instanceof Error ? e.message : e}` };
  }

  // Check 1: hash the canonical committed chapter file (GitHub raw = the exact
  // bytes that were stamped, LF endings) and compare to the .ots commitment.
  let fileHash: string | null = null;
  try {
    const res = await fetch(rawFileUrl, { next: { revalidate: 3600 } });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      fileHash = createHash("sha256").update(buf).digest("hex");
    }
  } catch {
    /* leave fileHash null */
  }
  const fileMatches = Boolean(fileHash && otsFileHash && fileHash === otsFileHash);

  // Check 2: confirm the .ots's block merkle root matches the REAL block's
  // merkle root from a public explorer (independent of us).
  let blockHash: string | null = null;
  let blockTime: number | null = null;
  let blockMerkleRoot: string | null = null;
  let rootMatches: boolean | null = null;
  if (block != null) {
    try {
      blockHash = (await (await fetch(`https://mempool.space/api/block-height/${block}`)).text()).trim();
      const blk = await (await fetch(`https://mempool.space/api/block/${blockHash}`)).json();
      blockMerkleRoot = String(blk.merkle_root || "").toLowerCase();
      blockTime = typeof blk.timestamp === "number" ? blk.timestamp : null;
      if (otsMerkleRoot && blockMerkleRoot) {
        rootMatches =
          otsMerkleRoot === blockMerkleRoot || reverseHex(otsMerkleRoot) === blockMerkleRoot;
      }
    } catch {
      rootMatches = null; // explorer unreachable; check 1 still stands
    }
  }

  return {
    ...base,
    ok: fileMatches && rootMatches === true,
    fileMatches,
    rootMatches,
    fileHash,
    otsFileHash,
    block,
    blockHash,
    blockTime,
    otsMerkleRoot,
    blockMerkleRoot,
  };
}
