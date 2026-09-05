import { NextResponse } from "next/server";
import { loadChapters } from "@/lib/chapters";
import {
  getBinaryFileFromGitHub,
  updateBinaryFileOnGitHub,
  getFileFromGitHub,
  createFileOnGitHub,
  updateFileOnGitHub,
  triggerVercelDeploy,
} from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily job: a freshly published chapter's OpenTimestamps proof is "pending"
// (calendar-only) until Bitcoin confirms it ~a day later. This upgrades any
// pending .ots to a complete, self-contained Bitcoin proof and writes a small
// {slug}.btc.json sidecar (block height/hash/time) that the proof panel reads
// to link the real block. Idempotent: it only commits when something changed.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const url = new URL(req.url);
  const provided = auth.replace(/^Bearer\s+/i, "") || url.searchParams.get("secret") || "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const otsMod = await import("opentimestamps");
  const OTS = (otsMod as unknown as { default?: unknown }).default ?? otsMod;
  const O = OTS as {
    DetachedTimestampFile: { deserialize: (b: Uint8Array) => unknown };
    info: (d: unknown) => string;
    upgrade: (d: unknown) => Promise<boolean>;
  };

  const chapters = loadChapters();
  const results: Record<string, string> = {};
  let anyChange = false;

  for (const c of chapters) {
    const slug = c.slug;
    const otsPath = `public/proofs/ots/${slug}.ots`;
    try {
      const got = await getBinaryFileFromGitHub(otsPath);
      if (!got.ok) {
        results[slug] = got.missing ? "no .ots" : `read error: ${got.error}`;
        continue;
      }
      const bytes = Buffer.from(got.base64, "base64");
      const detached = O.DetachedTimestampFile.deserialize(new Uint8Array(bytes));

      let upgraded = false;
      try {
        upgraded = await O.upgrade(detached);
      } catch {
        /* calendars unreachable — try again next run */
      }

      if (upgraded) {
        const newB64 = Buffer.from(
          (detached as { serializeToBytes: () => Uint8Array }).serializeToBytes()
        ).toString("base64");
        const up = await updateBinaryFileOnGitHub(
          otsPath,
          newB64,
          got.sha,
          `Upgrade OpenTimestamps proof for ${slug} (Bitcoin attestation)`
        );
        if (!up.ok) {
          results[slug] = `upgrade commit failed: ${up.error}`;
          continue;
        }
        anyChange = true;
      }

      // Whether we just upgraded or it was already confirmed, make sure the
      // sidecar reflects the earliest Bitcoin block.
      const heights = [...O.info(detached).matchAll(/BitcoinBlockHeaderAttestation\((\d+)\)/g)].map(
        (m) => Number(m[1])
      );
      if (!heights.length) {
        results[slug] = upgraded ? "upgraded (no block yet?)" : "still pending";
        continue;
      }
      const block = Math.min(...heights);

      const sidecarPath = `public/proofs/ots/${slug}.btc.json`;
      const existing = await getFileFromGitHub(sidecarPath);
      const alreadyCorrect =
        existing.ok && (() => {
          try {
            return JSON.parse(existing.content).block === block;
          } catch {
            return false;
          }
        })();
      if (alreadyCorrect) {
        results[slug] = upgraded ? `upgraded; block ${block}` : `ok; block ${block}`;
        continue;
      }

      const hash = (
        await (await fetch(`https://mempool.space/api/block-height/${block}`)).text()
      ).trim();
      const blk = await (await fetch(`https://mempool.space/api/block/${hash}`)).json();
      const sidecar = JSON.stringify({ block, hash, time: blk.timestamp }, null, 2) + "\n";
      const msg = `Record Bitcoin block for ${slug} proof (#${block})`;
      const wrote = existing.ok
        ? await updateFileOnGitHub(sidecarPath, sidecar, existing.sha, msg)
        : await createFileOnGitHub(sidecarPath, sidecar, msg);
      if (!wrote.ok) {
        results[slug] = `sidecar failed: ${wrote.error}`;
        continue;
      }
      anyChange = true;
      results[slug] = `block ${block} recorded`;
    } catch (e) {
      results[slug] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const deployed = anyChange ? await triggerVercelDeploy() : false;
  return NextResponse.json({ ok: true, changed: anyChange, deployed, results });
}

// Allow GET too, so a Vercel Cron (which issues GET) can trigger it.
export const GET = POST;
