import Link from "next/link";
import { notFound } from "next/navigation";
import { renderMarkdown } from "@/lib/markdown";
import { getChapter, loadChapters, costBasis, totalShares, firstBuyDate, chapterOtsUrl } from "@/lib/chapters";
import { getChapterPerf, getChapterCandles } from "@/lib/quotes";
import { formatFillTime, formatDate } from "@/lib/format";
import BrandMark from "@/components/BrandMark";
import ReadAloudButton from "@/components/ReadAloudButton";
import CandleChart from "@/components/CandleChart";
import ProofPanel from "@/components/ProofPanel";

export const revalidate = 3600;

export function generateStaticParams() {
  return loadChapters().map((c) => ({ slug: c.slug }));
}

const fmtTimestamp = formatFillTime;

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const chapter = getChapter(slug);
  if (!chapter) notFound();

  const perf = await getChapterPerf(chapter);
  const chart = await getChapterCandles(chapter);
  const avgCost = costBasis(chapter) / totalShares(chapter);

  return (
    <main className="mx-auto max-w-3xl px-6 pt-12">
      <Link href="/" className="text-sm text-tape underline">
        ← Table of contents
      </Link>

      <header className="mt-6">
        <div className="flex items-center gap-3">
          <span className="text-sm uppercase tracking-wide text-ink-soft">
            Chapter {chapter.chapter}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-sans font-semibold ${
              chapter.status === "open"
                ? "bg-tape/10 text-tape"
                : "bg-wall-dark text-ink-soft"
            }`}
          >
            {chapter.status === "open" ? "drying" : "dried · finished"}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <BrandMark ticker={chapter.ticker} logo={chapter.logo} domain={chapter.domain} size={48} />
          <h1 className="text-3xl sm:text-4xl font-bold">
            {chapter.company ? `${chapter.company} (${chapter.ticker})` : chapter.ticker} —{" "}
            {chapter.title}
          </h1>
        </div>
      </header>

      {/* The record */}
      <section className="mt-8 rounded-lg bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-wall-dark text-ink-soft">
              <th className="px-4 py-3 font-normal">Event</th>
              <th className="px-4 py-3 font-normal">Timestamp</th>
              <th className="px-4 py-3 font-normal text-right">Price</th>
              <th className="px-4 py-3 font-normal text-right">Shares</th>
            </tr>
          </thead>
          <tbody>
            {chapter.buys.map((b, i) => (
              <tr key={i} className="border-b border-wall last:border-0">
                <td className="px-4 py-3">
                  Buy{b.note ? ` — ${b.note}` : ""}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{fmtTimestamp(b.date)}</td>
                <td className="px-4 py-3 text-right">${b.price.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{b.shares}</td>
              </tr>
            ))}
            {chapter.sell && (
              <tr className="border-t-2 border-wall-dark bg-wall/60">
                <td className="px-4 py-3 font-semibold">
                  Sell — chapter closed{chapter.sell.note ? ` — ${chapter.sell.note}` : ""}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {fmtTimestamp(chapter.sell.date)}
                </td>
                <td className="px-4 py-3 text-right">${chapter.sell.price.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">all</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 text-sm text-ink-soft border-t border-wall flex flex-wrap gap-x-6 gap-y-1">
          <span>Avg cost: ${avgCost.toFixed(2)}</span>
          <span>
            {chapter.status === "open" ? "Last close" : "Exit"}:{" "}
            {perf.currentPrice !== null ? `$${perf.currentPrice.toFixed(2)}` : "—"}
            {perf.asOf ? ` (${formatDate(perf.asOf)})` : ""}
          </span>
          <span>
            Return so far: <b>{fmtPct(perf.returnPct)}</b>
          </span>
        </div>
      </section>

      {/* Candlestick chart since the buy */}
      {chart && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-soft">Since the buy</h2>
          <CandleChart data={chart} ticker={chapter.ticker} />
        </section>
      )}

      {/* Exit plan, written at entry */}
      {chapter.exitTest && (
        <section className="mt-6 rounded-lg border-l-4 border-tape bg-white px-6 py-4 shadow-sm">
          <h2 className="font-bold text-sm uppercase tracking-wide text-ink-soft">
            The exit plan — written on day one
          </h2>
          <p className="mt-1 text-lg italic whitespace-pre-line">{chapter.exitTest}</p>
        </section>
      )}

      {/* How you know this is real */}
      <div className="mt-6">
        <ProofPanel
          slug={chapter.slug}
          ticker={chapter.ticker}
          buyDate={firstBuyDate(chapter)}
          proofs={chapter.proofs}
          otsUrl={chapterOtsUrl(chapter.slug)}
        />
      </div>

      {/* The why */}
      <div className="mt-8">
        <ReadAloudButton text={`Chapter ${chapter.chapter}. ${chapter.title}. ${chapter.body}`} />
      </div>
      <article
        className="prose-book mt-4"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(chapter.body) }}
      />
    </main>
  );
}
