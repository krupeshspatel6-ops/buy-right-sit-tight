import Link from "next/link";
import { chapterCommitsUrl, chapterFileUrl } from "@/lib/repo";
import { formatDate } from "@/lib/format";
import ProofImage from "@/components/ProofImage";
import type { BitcoinProof } from "@/lib/chapters";

// The independent ways a reader can confirm a chapter is a real, unedited,
// real-time trade — timestamp proof, the market tape, and the broker slip.
export default function ProofPanel({
  slug,
  ticker,
  buyDate,
  proofs,
  otsUrl,
  btc,
}: {
  slug: string;
  ticker: string;
  buyDate: string;
  proofs: string[];
  otsUrl?: string | null;
  btc?: BitcoinProof | null;
}) {
  return (
    <div className="mb-6 rounded-xl border border-dashed border-wall-dark bg-white px-5 py-4">
      <span className="chip chip-muted">How you know this is real</span>

      <ol className="mt-3 space-y-3 text-sm leading-relaxed">
        <li>
          <b>Timestamped by GitHub, not by me.</b> This chapter is a public commit — GitHub
          stamps the exact time it was published. It can&apos;t be backdated, and it&apos;s
          never edited (corrections are only appended, dated).{" "}
          <a
            href={chapterCommitsUrl(slug)}
            target="_blank"
            rel="noreferrer"
            className="font-grotesk font-bold text-tape underline"
          >
            See the commit history →
          </a>
        </li>
        <li>
          <b>The price is on the tape.</b> The buy price sits right on the real {ticker}{" "}
          candle in the chart above — cross-check it against {formatDate(buyDate)} market data
          anywhere. A made-up price wouldn&apos;t line up.
        </li>
        {proofs.length > 0 && (
          <li>
            <b>The broker&apos;s own confirmation.</b> Fidelity&apos;s fill slip — ticker,
            time, price, and quantity — with account details redacted.
            <div className="mt-3 flex flex-wrap gap-3">
              {proofs.map((p) => (
                <ProofImage key={p} src={p} alt={`Broker confirmation for the ${ticker} buy`} />
              ))}
            </div>
          </li>
        )}
        {otsUrl && (
          <li>
            <b>Anchored to the Bitcoin blockchain.</b>{" "}
            {btc ? (
              <>
                This chapter&apos;s fingerprint is locked into{" "}
                <a
                  href={`https://mempool.space/block/${btc.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-grotesk font-bold text-tape underline"
                >
                  Bitcoin block #{btc.block.toLocaleString("en-US")} ↗
                </a>{" "}
                ({formatDate(new Date(btc.time * 1000).toISOString())}) — a timestamp nobody can
                forge or backdate, not even me.
                <span className="mt-2 block">
                  <Link
                    href={`/verify/${slug}`}
                    className="font-grotesk font-bold text-tape underline"
                  >
                    ✅ See this proof checked for you, step by step →
                  </Link>
                </span>
                <span className="mt-1 block text-[12px] text-ink-soft">
                  Prefer to do it yourself? Grab the{" "}
                  <a href={otsUrl} className="underline">.ots proof</a> and the{" "}
                  <a
                    href={chapterFileUrl(slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    chapter file
                  </a>{" "}
                  and drop both into{" "}
                  <a
                    href="https://opentimestamps.org"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    opentimestamps.org
                  </a>
                  .
                </span>
              </>
            ) : (
              <>
                This chapter&apos;s fingerprint is timestamped with{" "}
                <a
                  href="https://opentimestamps.org"
                  target="_blank"
                  rel="noreferrer"
                  className="font-grotesk font-bold text-tape underline"
                >
                  OpenTimestamps
                </a>{" "}
                — a timestamp nobody can forge or backdate, not even me. The Bitcoin
                confirmation settles within about a day of publishing; once it does, the exact
                block shows up right here.
              </>
            )}
          </li>
        )}
      </ol>
    </div>
  );
}
