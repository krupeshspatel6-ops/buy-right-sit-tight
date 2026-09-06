import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getChapter, loadChapters } from "@/lib/chapters";
import { verifyChapterProof } from "@/lib/verify-proof";
import { formatDate } from "@/lib/format";

export const revalidate = 3600;

export function generateStaticParams() {
  return loadChapters().map((c) => ({ slug: c.slug }));
}

export const metadata: Metadata = {
  title: "Proof check — Buy Right Sit Tight",
  description: "See a chapter's Bitcoin-blockchain timestamp checked for you, with every hash shown so you can re-verify it independently.",
};

function fmtTime(unix: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }) + " UTC";
}

// A monospace hash chip that wraps on small screens.
function Hash({ value }: { value: string | null }) {
  return (
    <code className="break-all font-mono text-[12px] text-ink">{value || "—"}</code>
  );
}

export default async function VerifyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const chapter = getChapter(slug);
  if (!chapter) notFound();

  const v = await verifyChapterProof(slug);
  const who = chapter.company ? `${chapter.company} (${chapter.ticker})` : chapter.ticker;
  const mempool = v.blockHash ? `https://mempool.space/block/${v.blockHash}` : null;

  const verdict = v.ok
    ? { tone: "gain", icon: "✅", title: "Verified on the Bitcoin blockchain" }
    : v.fileMatches && v.rootMatches === null
      ? { tone: "tape", icon: "🔎", title: "File verified — block explorer unreachable right now" }
      : v.error && !v.block
        ? { tone: "soft", icon: "⏳", title: "Not yet anchored to Bitcoin" }
        : { tone: "loss", icon: "⚠️", title: "Could not fully verify" };

  const toneClass =
    verdict.tone === "gain"
      ? "border-gain/40 bg-gain/5"
      : verdict.tone === "loss"
        ? "border-loss/40 bg-loss/5"
        : verdict.tone === "tape"
          ? "border-tape/40 bg-tape/5"
          : "border-wall-dark bg-white";

  return (
    <main className="mx-auto max-w-3xl px-6 pt-12 pb-16">
      <Link href={`/chapter/${slug}`} className="text-sm text-tape underline">
        ← Back to Chapter {chapter.chapter}
      </Link>

      <p className="mt-6 text-sm uppercase tracking-widest text-ink-soft">Proof check</p>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
        Chapter {chapter.chapter} — {who}
      </h1>

      {/* Verdict */}
      <div className={`mt-6 rounded-2xl border px-5 py-5 ${toneClass}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>{verdict.icon}</span>
          <span className="text-lg font-bold">{verdict.title}</span>
        </div>
        {v.block && (
          <p className="mt-3 text-sm leading-relaxed">
            This chapter&apos;s exact text was locked into{" "}
            <b>Bitcoin block #{v.block.toLocaleString("en-US")}</b>, mined on{" "}
            <b>{fmtTime(v.blockTime)}</b>. That means it already existed by then and{" "}
            <b>hasn&apos;t changed since</b> — proven by the Bitcoin network, not by us.
            Anyone who tried to backdate or edit it would produce a different fingerprint that
            wouldn&apos;t match this block.
          </p>
        )}
        {!v.block && v.error && <p className="mt-3 text-sm text-ink-soft">{v.error}</p>}
      </div>

      {/* The checks, with every value shown */}
      <h2 className="mt-8 text-lg font-bold">How this was checked</h2>
      <p className="mt-1 text-sm text-ink-soft">
        We did the work for you — but every number below is public, so you can re-check each
        line yourself.
      </p>

      <ol className="mt-4 space-y-4">
        <li className="rounded-xl border border-wall-dark bg-white px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <span aria-hidden>{v.fileMatches ? "✅" : "⚠️"}</span>
            1 · The proof is for this exact chapter
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            The{" "}
            <a href={v.rawFileUrl} target="_blank" rel="noreferrer" className="text-tape underline">
              chapter file
            </a>{" "}
            has a unique SHA-256 fingerprint. It matches the fingerprint recorded inside the
            timestamp proof — so the proof can only belong to this text, unchanged.
          </p>
          <dl className="mt-2 space-y-1 text-[12px]">
            <div>
              <dt className="text-ink-soft">The file&apos;s fingerprint</dt>
              <dd><Hash value={v.fileHash} /></dd>
            </div>
            <div>
              <dt className="text-ink-soft">Fingerprint inside the proof</dt>
              <dd><Hash value={v.otsFileHash} /></dd>
            </div>
          </dl>
        </li>

        <li className="rounded-xl border border-wall-dark bg-white px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <span aria-hidden>{v.rootMatches ? "✅" : v.rootMatches === null ? "🔎" : "⚠️"}</span>
            2 · The proof is anchored in a real Bitcoin block
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            The proof resolves to a Bitcoin block&apos;s merkle root — the fingerprint of
            everything in that block. It matches the merkle root of the{" "}
            {mempool ? (
              <a href={mempool} target="_blank" rel="noreferrer" className="text-tape underline">
                real block #{v.block?.toLocaleString("en-US")}
              </a>
            ) : (
              <>real block</>
            )}{" "}
            reported by an independent explorer — so this proof genuinely lives in that block.
            {v.rootMatches === null && " (Couldn't reach the explorer just now — try again in a moment; the file check above already holds.)"}
          </p>
          <dl className="mt-2 space-y-1 text-[12px]">
            <div>
              <dt className="text-ink-soft">Merkle root the proof resolves to</dt>
              <dd><Hash value={v.otsMerkleRoot} /></dd>
            </div>
            <div>
              <dt className="text-ink-soft">Merkle root of the real block</dt>
              <dd><Hash value={v.blockMerkleRoot} /></dd>
            </div>
          </dl>
        </li>

        <li className="rounded-xl border border-wall-dark bg-white px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <span aria-hidden>🕒</span>
            3 · When Bitcoin says it happened
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            Block #{v.block?.toLocaleString("en-US") ?? "—"} was mined on{" "}
            <b className="text-ink">{fmtTime(v.blockTime)}</b> — the blockchain&apos;s own clock,
            which no one can rewind. So this chapter provably existed by then.
          </p>
          <p className="mt-2 rounded-md bg-wall/50 px-3 py-2 text-[12px] text-ink-soft">
            <b className="text-ink">A note on the time:</b> we show it in <b>UTC</b> — the fixed,
            universal clock used for proofs. A block explorer like mempool.space usually shows
            the same moment in <i>your</i> local timezone, so the clock time can look a few hours
            different. It&apos;s the exact same instant.
          </p>
        </li>
      </ol>

      {/* Do it yourself */}
      <div className="mt-8 rounded-xl border border-dashed border-wall-dark bg-white px-5 py-4 text-sm leading-relaxed text-ink-soft">
        <b className="text-ink">Want to verify it entirely on your own?</b> Download the{" "}
        {v.otsUrl ? (
          <a href={v.otsUrl} className="text-tape underline">.ots proof</a>
        ) : (
          <>.ots proof</>
        )}{" "}
        and the{" "}
        <a href={v.rawFileUrl} target="_blank" rel="noreferrer" className="text-tape underline">
          chapter file
        </a>
        , then drop both into{" "}
        <a href="https://opentimestamps.org" target="_blank" rel="noreferrer" className="text-tape underline">
          opentimestamps.org
        </a>{" "}
        (or run the <code className="font-mono">ots</code> tool). It will independently confirm
        the same block and time shown above — nothing here depends on trusting this site.
      </div>
    </main>
  );
}
