import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { renderMarkdown } from "@/lib/markdown";
import BookReader, { type SideTocEntry } from "@/components/BookReader";
import CoverArt from "@/components/CoverArt";
import {
  loadChapters,
  loadPreface,
  costBasis,
  firstBuyDate,
  totalShares,
  chapterOtsUrl,
  type Chapter,
} from "@/lib/chapters";
import { getScoreboard, getChapterCandles, type Scoreboard, type ChapterChart } from "@/lib/quotes";
import { formatFillTime, formatDate } from "@/lib/format";
import BrandMark from "@/components/BrandMark";
import ReadAloudButton from "@/components/ReadAloudButton";
import CandleChart from "@/components/CandleChart";
import ProofPanel from "@/components/ProofPanel";
import EntryBadge from "@/components/EntryBadge";
import TheCode from "@/components/TheCode";

export const revalidate = 3600;

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function PctCell({ v }: { v: number | null }) {
  const cls = v === null ? "text-ink-soft" : v >= 0 ? "text-gain" : "text-loss";
  return <span className={`font-semibold ${cls}`}>{fmtPct(v)}</span>;
}

// The wall keeps getting painted — one chapter per buy, no fixed number. The
// fill approaches full but never quite reaches it, so there's always more wall.
function wallPct(n: number): number {
  return n <= 0 ? 0 : Math.round((100 * n) / (n + 25));
}

const fmtDate = formatDate;
const fmtTimestamp = formatFillTime;

export default async function Home() {
  const chapters = loadChapters();
  const preface = loadPreface();
  const scoreboard = await getScoreboard(chapters);
  // Candlestick data per chapter (from the buy date). Same Yahoo URL as the
  // scoreboard, so Next dedupes the requests.
  const chartList = await Promise.all(chapters.map((c) => getChapterCandles(c)));
  const charts = new Map<number, ChapterChart | null>();
  chapters.forEach((c, i) => charts.set(c.chapter, chartList[i]));
  const open = chapters.filter((c) => c.status === "open");
  const closed = chapters.filter((c) => c.status === "closed");
  const codeCount = chapters.filter((c) => c.entry === "code").length;
  const hasPhoto = fs.existsSync(path.join(process.cwd(), "public", "sitting.jpg"));
  const coverImage = hasPhoto ? "/sitting.jpg" : "/sitting-wide.svg";

  /* ---- The ledger: end-of-day portfolio tracking in the left margin ---- */
  const fmtMoney = (v: number) =>
    `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const openRows = open.map((c) => {
    const p = scoreboard.chapterPerfs.get(c.chapter);
    const shares = totalShares(c);
    return {
      chapter: c.chapter,
      ticker: c.ticker,
      lastClose: p?.currentPrice ?? null,
      value: p?.currentPrice != null ? p.currentPrice * shares : null,
      returnPct: p?.returnPct ?? null,
    };
  });
  const portfolioValue =
    open.length === 0
      ? 0
      : openRows.every((r) => r.value !== null)
        ? openRows.reduce((s, r) => s + (r.value ?? 0), 0)
        : null;
  const investedOpen = open.reduce((s, c) => s + costBasis(c), 0);
  const realized = closed.reduce((s, c) => {
    const shares = totalShares(c);
    const avg = costBasis(c) / shares;
    return s + ((c.sell?.price ?? avg) - avg) * shares;
  }, 0);
  const asOf = [...scoreboard.chapterPerfs.values()]
    .map((p) => p.asOf)
    .filter((d): d is string => d !== null)
    .sort()
    .pop();

  const ledger = (
    <div>
      <div className="caption-rule mb-3">The ledger</div>

      <div className="stat-card">
        <div className="stat-label">Portfolio value · EOD</div>
        <div className="stat-num">{portfolioValue !== null ? fmtMoney(portfolioValue) : "—"}</div>
        <div className="stat-sub">
          {open.length > 0
            ? `${open.length} open position${open.length === 1 ? "" : "s"} · cost ${fmtMoney(investedOpen)}`
            : "waiting for chapter one"}
        </div>
      </div>

      {/* The holdings themselves are the chapters — see the table of contents. */}

      {closed.length > 0 && (
        <p className="font-grotesk mt-3 text-[12px] text-ink-soft">
          Realized ({closed.length} closed):{" "}
          <span className={realized >= 0 ? "text-gain" : "text-loss"}>
            {realized >= 0 ? "+" : "−"}
            {fmtMoney(Math.abs(realized))}
          </span>
        </p>
      )}

      {open.length === 0 && closed.length === 0 && (
        <p className="mt-3 text-xs leading-relaxed text-ink-soft">
          No positions yet. The ledger opens with Chapter 1.
        </p>
      )}

      <p className="mt-4 border-t border-wall-dark pt-2 text-[11px] leading-relaxed text-ink-soft">
        {asOf
          ? `Prices as of ${fmtDate(asOf)} market close.`
          : "Prices update after each market close."}{" "}
        Tracked automatically — never typed in by hand.
      </p>
    </div>
  );

  const pages: React.ReactNode[] = [];
  const sideToc: SideTocEntry[] = [];

  /* ---- Page: cover ---- */
  sideToc.push({ label: "Cover", pageIndex: pages.length });
  pages.push(
    <div
      key="cover"
      className="-mx-8 -my-8 sm:-mx-14 flex min-h-[76vh] flex-col"
    >
      {/* full-bleed illustration — the wall paints itself, 2% per chapter */}
      <div className="relative flex-none overflow-hidden rounded-tl-[4px] rounded-tr-[10px]">
        {hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt="The author sits in a folding chair, watching a half-painted wall dry"
            className="h-[22vh] w-full object-cover object-center sm:h-[30vh]"
          />
        ) : (
          <CoverArt progress={wallPct(chapters.length)} />
        )}
        <span className="absolute right-5 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-widest text-tape shadow-sm">
          <span className="live-dot live-dot-pulse" aria-hidden /> live
        </span>
        {!hasPhoto && (
          <span className="absolute left-5 top-4 rounded-full bg-white/90 px-3 py-1 text-xs uppercase tracking-widest text-ink-soft shadow-sm">
            wall painted: {wallPct(chapters.length)}%
          </span>
        )}
      </div>

      {/* title block — justify-evenly keeps everything on one screen */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-evenly px-8 py-4 text-center">
        <h1 className="cover-title whitespace-nowrap font-bold leading-none tracking-tight text-[min(6.5vh,5.8vw)]">
          Buy Right Sit Tight
        </h1>
        <p className="tape-strip">watch the paint dry.</p>

        <div className="flex items-center gap-3 text-ink-soft" aria-hidden>
          <span className="h-px w-16 bg-wall-dark" />
          <span className="text-xs">·</span>
          <span className="h-px w-16 bg-wall-dark" />
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-ink-soft">
            being written by
          </p>
          <p className="mt-1 tracking-wide text-[min(3.2vh,1.5rem)]">Krupesh Patel</p>
        </div>

        <div>
          <p className="text-sm uppercase tracking-widest text-ink-soft">
            a <span className="live-badge"><span className="live-dot" aria-hidden /> live</span>{" "}
            book · one buy at a time
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-ink-soft">
            begun August 2026 · written in real time, one buy at a time · every
            chapter timestamped · never edited after publication
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.25em] text-ink-soft">
            buyrightsittight.com
          </p>
        </div>
      </div>
    </div>
  );

  /* ---- Page: why I'm writing this (the origin story — first thing after the cover) ---- */
  if (preface) {
    sideToc.push({ label: "Why I'm writing this", pageIndex: pages.length });
    pages.push(
      <div key="why">
        <h2 className="text-2xl font-bold mb-6">Why I&apos;m writing this</h2>
        <article
          className="prose-book"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(preface) }}
        />
      </div>
    );
  }

  /* ---- Page: the pledge ---- */
  sideToc.push({ label: "The pledge", pageIndex: pages.length });
  pages.push(
    <div key="pledge" className="flex min-h-full flex-col justify-center py-2">
      <h2 className="text-2xl font-bold mb-6">The pledge</h2>
      <ol className="space-y-4 prose-book list-decimal pl-5">
        <li>
          <b>Every stock I buy with my own money opens a new chapter</b> —
          published within 24 hours of the fill, with the real price and a
          timestamp. No exceptions, no deletions.
        </li>
        <li>
          <b>A chapter only closes when I sell.</b> If I never sell, the chapter
          never ends. That&apos;s the point.
        </li>
        <li>
          <b>Nothing is edited after publication.</b> Corrections are appended,
          dated, below the original. My bad calls stay on the page next to my
          good ones.
        </li>
        <li>
          <b>Every chapter states, on day one, what would make me sell</b> — so
          future-me can&apos;t quietly rewrite the story.
        </li>
        <li>
          <b>There is no set number of chapters — and no finish line.</b> A new
          one opens for every stock I buy, for as long as I keep investing. The
          wall just keeps getting painted. The point isn&apos;t to fill it; it&apos;s
          to keep showing up.
        </li>
      </ol>

      <div className="mt-8 border-t border-wall-dark pt-5 text-sm leading-relaxed text-ink-soft">
        <p>
          <b className="text-ink">A note as this grows.</b> I started this book at 15, and I
          will get things wrong — bad calls, clumsy writing, ideas I later see differently.
          Those mistakes stay right here on the page; that&apos;s part of the point.
        </p>
        <p className="mt-3">
          The <i>look</i> of this site will keep changing as I learn — the layout, the
          charts, the tools around it. The one thing that never changes is the record
          underneath it all: <b className="text-ink">what I bought, at what price, on what
          day.</b> Those are real, live trades — published as they happen and never edited.
          Everything else here is just the wrapping around that one honest fact.
        </p>
      </div>
    </div>
  );

  /* ---- Page: the code (the engine behind many of the buys) ---- */
  sideToc.push({ label: "The code", sub: "the engine", pageIndex: pages.length });
  pages.push(
    <div key="the-code" className="py-2">
      <TheCode chapters={chapters} />
    </div>
  );

  /* ---- Page: table of contents = the portfolio ---- */
  sideToc.push({ label: "Table of contents", sub: "the portfolio", pageIndex: pages.length });
  pages.push(
    <div key="toc">
      <h2 className="text-2xl font-bold mb-2">Table of contents</h2>
      <p className="text-sm text-ink-soft mb-6">
        The table of contents is the portfolio. Open chapters are holdings;
        closed chapters are the realized record.
      </p>

      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-ink-soft mb-2">
          <span className="uppercase tracking-wide">The wall</span>
          <span>
            {chapters.length} chapter{chapters.length === 1 ? "" : "s"} · and counting
          </span>
        </div>
        <div className="h-3 rounded-full bg-wall-dark overflow-hidden">
          <div
            className="h-full bg-tape"
            style={{ width: `${wallPct(chapters.length)}%` }}
          />
        </div>
      </div>

      <div className="mb-6">
        <div className="stat-card inline-block">
          <div className="stat-label">The book</div>
          <div className="stat-num !text-[2rem]">
            <PctCell v={scoreboard.totalReturnPct} />
          </div>
          <div className="stat-sub">all picks, cost-weighted</div>
        </div>
      </div>

      {codeCount > 0 && (
        <p className="mb-6 text-[13px] text-ink-soft">
          <span aria-hidden>⚡</span>{" "}
          <b className="text-ink">
            {codeCount} of {chapters.length}
          </b>{" "}
          began as a signal from{" "}
          <Link href="/the-code" className="text-tape underline">
            the code
          </Link>
          .
        </p>
      )}

      {chapters.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-wall-dark px-6 py-10 text-center text-ink-soft">
          <p className="text-lg">Chapter One hasn&apos;t happened yet.</p>
          <p className="mt-2 text-sm">Turn the page.</p>
        </div>
      ) : (
        <TocSection title="The chapters" chapters={chapters} scoreboard={scoreboard} />
      )}
    </div>
  );

  /* ---- Pages: chapters, or the waiting page ---- */
  if (chapters.length === 0) {
    sideToc.push({
      label: "Chapter 1",
      sub: "(waiting for the first buy)",
      pageIndex: pages.length,
    });
    pages.push(
      <div key="waiting" className="flex h-full min-h-[62vh] flex-col justify-center">
        <p className="text-sm uppercase tracking-widest text-ink-soft">Chapter One</p>
        <h2 className="text-3xl font-bold mt-2 mb-8 italic text-ink-soft">
          (waiting for the first buy)
        </h2>
        <div className="prose-book">
          <p>The wall is primed. The chair is unfolded. The mug is full.</p>
          <p>
            I have no quota and no deadline — just the whole market in front of
            me and a chapter waiting for the first buy. It will land on this page
            within twenty-four hours of the fill — real ticker, real price,
            real timestamp, and one honest paragraph about why.
          </p>
          <p>
            Until then, nothing happens here. Learning to be fine with that is
            the entire book.
          </p>
        </div>
      </div>
    );
  } else {
    for (const c of chapters) {
      const perf = scoreboard.chapterPerfs.get(c.chapter);
      const avgCost = costBasis(c) / totalShares(c);
      sideToc.push({
        label: `Chapter ${c.chapter}`,
        sub: c.company ? `${c.company} · ${c.ticker}` : c.ticker,
        pageIndex: pages.length,
      });
      pages.push(
        <div key={c.slug}>
          {/* Chapter opener — a color-block "part" page in our blue */}
          <div className="chapter-opener mb-6">
            <span className="opener-ghost">{c.chapter}</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip chip-solid">
                Chapter {c.chapter} · {c.status === "open" ? "drying" : "dried · finished"}
              </span>
              <EntryBadge kind={c.entry} note={c.entryNote} variant="opener" />
            </div>
            <div className="opener-ticker">{c.ticker}</div>
            <div className="mt-2 flex items-center gap-2.5">
              <BrandMark ticker={c.ticker} logo={c.logo} domain={c.domain} size={28} />
              <span className="font-grotesk text-[1.05rem] font-semibold" style={{ color: "#dbe7fb" }}>
                {c.company ? `${c.company} — ${c.title}` : c.title}
              </span>
            </div>
          </div>

          {/* the buys — hairline rows */}
          <div className="mb-5">
            {c.buys.map((b, i) => (
              <div
                key={i}
                className="rule-dashed font-grotesk flex items-baseline justify-between gap-3 py-2.5 text-[13px]"
              >
                <span className="font-bold">Buy{b.note ? ` — ${b.note}` : ""}</span>
                <span className="text-ink-soft">{fmtTimestamp(b.date)}</span>
                <span className="font-semibold">
                  ${b.price.toFixed(2)} × {b.shares}
                </span>
              </div>
            ))}
            {c.sell && (
              <div className="rule-dashed font-grotesk flex items-baseline justify-between gap-3 py-2.5 text-[13px] font-bold">
                <span>Sold{c.sell.note ? ` — ${c.sell.note}` : ""}</span>
                <span className="text-ink-soft">{fmtTimestamp(c.sell.date)}</span>
                <span>${c.sell.price.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* this chapter's return so far */}
          <div className="mb-6">
            <div className="stat-card inline-block">
              <div className="stat-label">This pick, so far</div>
              <div
                className={`stat-num !text-[1.9rem] ${
                  (perf?.returnPct ?? 0) >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {perf?.returnPct != null
                  ? `${perf.returnPct > 0 ? "+" : ""}${perf.returnPct.toFixed(1)}%`
                  : "—"}
              </div>
              <div className="stat-sub">
                avg ${avgCost.toFixed(2)} → ${perf?.currentPrice?.toFixed(2) ?? "—"}
                {perf?.asOf ? ` · ${fmtDate(perf.asOf)}` : ""}
              </div>
            </div>
          </div>

          {/* candlestick chart — the price action since the buy */}
          {charts.get(c.chapter) && (
            <div className="mb-6">
              <div className="caption-rule mb-2">Since the buy</div>
              <CandleChart data={charts.get(c.chapter)!} ticker={c.ticker} />
            </div>
          )}

          {c.exitTest && (
            <div className="border-l-4 border-tape pl-4 text-ink-soft mb-5">
              <div className="text-xs uppercase tracking-wide">The exit plan — written on day one</div>
              <p className="mt-1 italic whitespace-pre-line">{c.exitTest}</p>
            </div>
          )}

          <ProofPanel
            slug={c.slug}
            ticker={c.ticker}
            buyDate={firstBuyDate(c)}
            proofs={c.proofs}
            otsUrl={chapterOtsUrl(c.slug)}
          />

          <div className="mb-3">
            <ReadAloudButton text={`Chapter ${c.chapter}. ${c.title}. ${c.body}`} />
          </div>
          <article
            className="prose-book"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(c.body) }}
          />
          <p className="mt-6 text-sm">
            <Link href={`/chapter/${c.slug}`} className="text-tape underline">
              Permanent link to this chapter →
            </Link>
          </p>
        </div>
      );
    }
  }

  /* ---- Page: back cover ---- */
  sideToc.push({ label: "Back cover", pageIndex: pages.length });
  pages.push(
    <div
      key="back-cover"
      className="flex h-full min-h-[62vh] flex-col items-center justify-center text-center"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/sitting-done.svg"
        alt="The wall is fully painted and the tools are gone, but the man is still sitting in his chair with a mug"
        className="w-full max-w-[420px] rounded-md shadow-sm"
      />
      <p className="mt-8 text-3xl font-bold">The sitting continues.</p>
      <p className="mt-5 text-ink-soft max-w-sm">
        The wall got painted. The chair stayed. This book is still being
        written — come back after the next buy, or in five years, which is
        really the same thing.
      </p>
    </div>
  );

  return (
    <main className="py-4 sm:py-6">
      <BookReader pages={pages} sideToc={sideToc} ledger={ledger} />
    </main>
  );
}

function TocSection({
  title,
  chapters,
  scoreboard,
}: {
  title: string;
  chapters: Chapter[];
  scoreboard: Scoreboard;
}) {
  return (
    <div className="mb-6">
      <div className="caption-rule mb-1">{title}</div>
      <div>
        {chapters.map((c) => {
          const perf = scoreboard.chapterPerfs.get(c.chapter);
          return (
            <div
              key={c.slug}
              className="rule-dashed flex items-center gap-3 py-2.5"
            >
              <span className="font-display text-[1.7rem] leading-none text-ink">
                {String(c.chapter).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-grotesk flex items-center gap-2 text-[14px] font-bold">
                  <span className="truncate">{c.ticker}</span>
                  {c.status === "open" ? (
                    <span className="font-grotesk shrink-0 rounded-full bg-tape/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-tape">
                      drying
                    </span>
                  ) : (
                    <span className="font-grotesk shrink-0 rounded-full bg-wall-dark px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                      dried · finished
                    </span>
                  )}
                  <EntryBadge kind={c.entry} note={c.entryNote} variant="row" />
                </span>
                <span className="font-grotesk block text-[11px] text-ink-soft">
                  {c.company ? `${c.company} · ` : ""}
                  {fmtDate(firstBuyDate(c))}
                </span>
              </span>
              <span className="font-grotesk whitespace-nowrap text-[13px]">
                <PctCell v={perf?.returnPct ?? null} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
