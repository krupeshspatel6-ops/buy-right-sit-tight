import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { marked } from "marked";
import BookReader, { type SideTocEntry } from "@/components/BookReader";
import CoverArt from "@/components/CoverArt";
import {
  loadChapters,
  loadPreface,
  costBasis,
  firstBuyDate,
  totalShares,
  type Chapter,
} from "@/lib/chapters";
import { getScoreboard, type Scoreboard } from "@/lib/quotes";
import { formatFillTime, formatDate } from "@/lib/format";
import BrandMark from "@/components/BrandMark";
import { chapterCommitsUrl } from "@/lib/repo";
import ReadAloudButton from "@/components/ReadAloudButton";

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

const fmtDate = formatDate;
const fmtTimestamp = formatFillTime;

export default async function Home() {
  const chapters = loadChapters();
  const preface = loadPreface();
  const scoreboard = await getScoreboard(chapters);
  const open = chapters.filter((c) => c.status === "open");
  const closed = chapters.filter((c) => c.status === "closed");
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

  const picksAhead =
    scoreboard.picksValue !== null &&
    scoreboard.spyValue !== null &&
    scoreboard.picksValue >= scoreboard.spyValue;
  const showVs =
    scoreboard.invested > 0 && scoreboard.picksValue !== null && scoreboard.spyValue !== null;
  // Real matched: half the money is in picks, half in the S&P, so the portfolio
  // is worth both sides combined.
  const combinedValue =
    scoreboard.picksValue !== null && scoreboard.spyValue !== null
      ? scoreboard.picksValue + scoreboard.spyValue
      : null;

  const ledger = (
    <div>
      <div className="caption-rule mb-3">The ledger</div>

      <div className="stat-card">
        <div className="stat-label">Portfolio value · EOD</div>
        <div className="stat-num">
          {combinedValue !== null
            ? fmtMoney(combinedValue)
            : portfolioValue !== null
              ? fmtMoney(portfolioValue)
              : "—"}
        </div>
        <div className="stat-sub">
          {showVs
            ? `${fmtMoney(scoreboard.invested)} in picks + the same in the S&P`
            : "waiting for chapter one"}
        </div>
      </div>

      {showVs && scoreboard.picksValue !== null && scoreboard.spyValue !== null && (
        <div className="mt-4">
          <div className="caption-rule mb-2">Picks vs the S&amp;P 500</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="stat-card !p-3">
              <div className="stat-label">My picks</div>
              <div
                className={`stat-num !mt-1.5 !text-[1.55rem] ${picksAhead ? "text-gain" : "text-loss"}`}
              >
                {fmtMoney(scoreboard.picksValue)}
              </div>
            </div>
            <div className="stat-card !p-3">
              <div className="stat-label">S&amp;P 500</div>
              <div className="stat-num !mt-1.5 !text-[1.55rem]">{fmtMoney(scoreboard.spyValue)}</div>
            </div>
          </div>
          <p className="font-grotesk mt-2 text-[11px] font-semibold">
            {picksAhead ? (
              <span className="text-gain">
                Picks ahead by {fmtMoney(scoreboard.picksValue - scoreboard.spyValue)}
              </span>
            ) : (
              <span className="text-loss">
                S&amp;P ahead by {fmtMoney(scoreboard.spyValue - scoreboard.picksValue)}
              </span>
            )}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
            For every dollar in a pick, a real dollar in the S&amp;P the same day — half my
            money in each. {fmtMoney(scoreboard.invested)} a side.
          </p>
        </div>
      )}

      {open.length > 0 && (
        <div className="mt-4">
          <div className="caption-rule mb-1">Holdings</div>
          {openRows.map((r) => (
            <div
              key={r.chapter}
              className="rule-dashed font-grotesk flex items-baseline justify-between gap-2 py-2 text-[13px]"
            >
              <span className="font-bold">{r.ticker}</span>
              <span className="text-ink-soft">
                {r.lastClose !== null ? fmtMoney(r.lastClose) : "—"}
              </span>
              <span
                className={`font-bold ${
                  r.returnPct === null
                    ? "text-ink-soft"
                    : r.returnPct >= 0
                      ? "text-gain"
                      : "text-loss"
                }`}
              >
                {r.returnPct !== null
                  ? `${r.returnPct > 0 ? "+" : ""}${r.returnPct.toFixed(1)}%`
                  : "—"}
              </span>
            </div>
          ))}
          {/* the real S&P side, all matched buys together */}
          {scoreboard.spyReturnPct !== null && (
            <div className="rule-dashed font-grotesk flex items-baseline justify-between gap-2 py-2 text-[13px]">
              <span className="font-bold">VOO</span>
              <span className="text-ink-soft">S&amp;P match</span>
              <span
                className={`font-bold ${
                  scoreboard.spyReturnPct >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {`${scoreboard.spyReturnPct > 0 ? "+" : ""}${scoreboard.spyReturnPct.toFixed(1)}%`}
              </span>
            </div>
          )}
        </div>
      )}

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
      className="-mx-8 -my-8 sm:-mx-14 flex h-[76vh] flex-col overflow-hidden"
    >
      {/* full-bleed illustration — the wall paints itself, 2% per chapter */}
      <div className="relative flex-none overflow-hidden rounded-tl-[4px] rounded-tr-[10px]">
        {hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt="The author sits in a folding chair, watching a half-painted wall dry"
            className="h-[30vh] w-full object-cover object-center"
          />
        ) : (
          <CoverArt progress={chapters.length * 2} />
        )}
        <span className="absolute right-5 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-widest text-tape shadow-sm">
          <span className="live-dot live-dot-pulse" aria-hidden /> live
        </span>
        {!hasPhoto && (
          <span className="absolute left-5 top-4 rounded-full bg-white/90 px-3 py-1 text-xs uppercase tracking-widest text-ink-soft shadow-sm">
            wall painted: {Math.min(chapters.length * 2, 100)}%
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
            book in 50 chapters
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
          dangerouslySetInnerHTML={{ __html: marked.parse(preface) as string }}
        />
      </div>
    );
  }

  /* ---- Page: the pledge ---- */
  sideToc.push({ label: "The pledge", pageIndex: pages.length });
  pages.push(
    <div key="pledge" className="flex h-full min-h-[62vh] flex-col justify-center">
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
          <b>For every dollar I put in a pick, I put a real dollar in the S&amp;P
          500 (VOO) the same day.</b> Half my money is always in the index. If I
          can&apos;t beat just buying the market, the ledger will say so — in
          real money, right next to my picks.
        </li>
        <li>
          <b>The book has exactly 50 chapters.</b> A punch card with fifty
          slots for the rest of my life. Every buy spends one, permanently. A
          budget, not a quota — slots left blank are a feature, not a failure.
        </li>
      </ol>
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
          <span>{chapters.length} of 50 chapters opened</span>
        </div>
        <div className="h-3 rounded-full bg-wall-dark overflow-hidden">
          <div
            className="h-full bg-tape"
            style={{ width: `${Math.min(chapters.length * 2, 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="stat-card">
          <div className="stat-label">The book</div>
          <div className="stat-num !text-[2rem]">
            <PctCell v={scoreboard.totalReturnPct} />
          </div>
          <div className="stat-sub">all picks, cost-weighted</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">S&amp;P · same $, same days</div>
          <div className="stat-num !text-[2rem]">
            <PctCell v={scoreboard.spyReturnPct} />
          </div>
          <div className="stat-sub">the honest benchmark</div>
        </div>
      </div>

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
            I have a punch card with fifty slots in my pocket and the
            whole market in front of me. The first buy will land on this page
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
            <span className="chip chip-solid">
              Chapter {c.chapter} · {c.status === "open" ? "drying" : "dried · finished"}
            </span>
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

          {/* this chapter vs the same money in the S&P — stat cards */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="stat-card">
              <div className="stat-label">This pick</div>
              <div
                className={`stat-num !text-[1.9rem] ${
                  (perf?.returnPct ?? 0) >= (perf?.spyReturnPct ?? 0) ? "text-gain" : "text-loss"
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
            <div className="stat-card">
              <div className="stat-label">S&amp;P · same $, same days</div>
              <div className="stat-num !text-[1.9rem]">
                {perf?.spyReturnPct != null
                  ? `${perf.spyReturnPct > 0 ? "+" : ""}${perf.spyReturnPct.toFixed(1)}%`
                  : "—"}
              </div>
              <div className="stat-sub">the honest benchmark</div>
            </div>
          </div>

          {c.exitTest && (
            <div className="border-l-4 border-tape pl-4 text-ink-soft mb-5">
              <div className="text-xs uppercase tracking-wide">The exit plan — written on day one</div>
              <p className="mt-1 italic whitespace-pre-line">{c.exitTest}</p>
            </div>
          )}

          <div className="mb-5 rounded-xl border border-dashed border-wall-dark bg-white px-4 py-3">
            <span className="chip chip-muted">Proof — never edited</span>
            <a
              href={chapterCommitsUrl(c.slug)}
              target="_blank"
              rel="noreferrer"
              className="font-grotesk mt-2 block text-sm font-bold text-tape underline"
            >
              Timestamped commit history on GitHub →
            </a>
            {c.proofs.length > 0 && (
              <div className="mt-3">
                <div className="text-xs uppercase tracking-wide text-ink-soft mb-2">
                  Broker confirmation (Fidelity)
                </div>
                <div className="flex flex-wrap gap-3">
                  {c.proofs.map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={p}
                      src={p}
                      alt={`Broker confirmation for chapter ${c.chapter}`}
                      className="max-h-56 rounded border border-wall-dark"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mb-3">
            <ReadAloudButton text={`Chapter ${c.chapter}. ${c.title}. ${c.body}`} />
          </div>
          <article
            className="prose-book"
            dangerouslySetInnerHTML={{ __html: marked.parse(c.body) as string }}
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
                </span>
                <span className="font-grotesk block text-[11px] text-ink-soft">
                  {c.company ? `${c.company} · ` : ""}
                  {fmtDate(firstBuyDate(c))}
                </span>
              </span>
              <span className="font-grotesk whitespace-nowrap text-[13px]">
                <PctCell v={perf?.returnPct ?? null} />{" "}
                <span className="text-ink-soft">vs</span>{" "}
                <PctCell v={perf?.spyReturnPct ?? null} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
