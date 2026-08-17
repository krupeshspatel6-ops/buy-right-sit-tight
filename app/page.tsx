import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { marked } from "marked";
import BookReader, { type SideTocEntry } from "@/components/BookReader";
import CoverArt from "@/components/CoverArt";
import CoverIntro from "@/components/CoverIntro";
import {
  loadChapters,
  loadPreface,
  costBasis,
  firstBuyDate,
  totalShares,
  type Chapter,
} from "@/lib/chapters";
import { getScoreboard, type Scoreboard } from "@/lib/quotes";

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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

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

  const ledger = (
    <div>
      <h3 className="mb-3 text-xs uppercase tracking-widest text-ink-soft">The ledger</h3>
      <div className="rounded-lg bg-white p-4 shadow-sm text-sm">
        <p className="text-xs uppercase tracking-wide text-ink-soft">
          Portfolio value · end of day
        </p>
        <p className="mt-1 text-2xl font-bold">
          {portfolioValue !== null ? fmtMoney(portfolioValue) : "—"}
        </p>
        {open.length > 0 && (
          <p className="mt-1 text-xs text-ink-soft">
            {open.length} open position{open.length === 1 ? "" : "s"} · cost{" "}
            {fmtMoney(investedOpen)}
          </p>
        )}
        {closed.length > 0 && (
          <p className="mt-1 text-xs text-ink-soft">
            Realized ({closed.length} closed):{" "}
            <span className={realized >= 0 ? "text-gain" : "text-loss"}>
              {realized >= 0 ? "+" : "−"}{fmtMoney(Math.abs(realized))}
            </span>
          </p>
        )}

        {open.length > 0 && (
          <div className="mt-3 border-t border-wall pt-2">
            {openRows.map((r) => (
              <div key={r.chapter} className="flex items-baseline justify-between gap-2 py-1">
                <span className="font-bold">{r.ticker}</span>
                <span className="text-ink-soft">
                  {r.lastClose !== null ? fmtMoney(r.lastClose) : "—"}
                </span>
                <span
                  className={`font-semibold ${
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
          </div>
        )}

        {open.length === 0 && closed.length === 0 && (
          <p className="mt-2 text-xs text-ink-soft">
            No positions yet. The ledger opens with Chapter 1.
          </p>
        )}

        <p className="mt-3 border-t border-wall pt-2 text-[11px] leading-relaxed text-ink-soft">
          {asOf
            ? `Prices as of ${fmtDate(asOf)} market close.`
            : "Prices update after each market close."}{" "}
          Tracked automatically — never typed in by hand.
        </p>
      </div>
    </div>
  );

  const pages: React.ReactNode[] = [];
  const sideToc: SideTocEntry[] = [];

  /* ---- Page: cover ---- */
  sideToc.push({ label: "Cover", pageIndex: pages.length });
  pages.push(
    <div
      key="cover"
      className="-mx-8 -my-12 sm:-mx-14 flex h-[84vh] flex-col overflow-hidden"
    >
      {/* full-bleed illustration — the wall paints itself, 1% per chapter */}
      <div className="relative flex-none overflow-hidden rounded-tl-[4px] rounded-tr-[10px]">
        {hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt="The author sits in a folding chair, watching a half-painted wall dry"
            className="h-[30vh] w-full object-cover object-center"
          />
        ) : (
          <CoverArt progress={chapters.length} />
        )}
        <span className="absolute right-5 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-widest text-tape shadow-sm">
          <span className="live-dot live-dot-pulse" aria-hidden /> live
        </span>
        {!hasPhoto && (
          <span className="absolute left-5 top-4 rounded-full bg-white/90 px-3 py-1 text-xs uppercase tracking-widest text-ink-soft shadow-sm">
            wall painted: {Math.min(chapters.length, 100)}%
          </span>
        )}
        <CoverIntro />
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
            book in 100 chapters
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
          <b>The book has exactly 100 chapters.</b> A punch card with a hundred
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
          <span>{chapters.length} of 100 chapters opened</span>
        </div>
        <div className="h-3 rounded-full bg-wall-dark overflow-hidden">
          <div
            className="h-full bg-tape"
            style={{ width: `${Math.min(chapters.length, 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-lg border border-wall-dark px-4 py-3 text-center">
          <div className="text-xs text-ink-soft uppercase tracking-wide">The book</div>
          <div className="text-2xl mt-1">
            <PctCell v={scoreboard.totalReturnPct} />
          </div>
        </div>
        <div className="rounded-lg border border-wall-dark px-4 py-3 text-center">
          <div className="text-xs text-ink-soft uppercase tracking-wide">
            S&amp;P 500, same money, same days
          </div>
          <div className="text-2xl mt-1">
            <PctCell v={scoreboard.spyReturnPct} />
          </div>
        </div>
      </div>

      {chapters.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-wall-dark px-6 py-10 text-center text-ink-soft">
          <p className="text-lg">Chapter One hasn&apos;t happened yet.</p>
          <p className="mt-2 text-sm">Turn the page.</p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <TocSection
              title={`Still drying — open (${open.length})`}
              chapters={open}
              scoreboard={scoreboard}
            />
          )}
          {closed.length > 0 && (
            <TocSection
              title={`Dry — closed (${closed.length})`}
              chapters={closed}
              scoreboard={scoreboard}
            />
          )}
        </>
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
            I have a punch card with one hundred slots in my pocket and the
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
          <div className="flex items-center gap-3">
            <span className="text-sm uppercase tracking-widest text-ink-soft">
              Chapter {c.chapter}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                c.status === "open" ? "bg-tape/10 text-tape" : "bg-wall-dark text-ink-soft"
              }`}
            >
              {c.status === "open" ? "still drying" : "dry"}
            </span>
          </div>
          <h2 className="text-3xl font-bold mt-1 mb-5">
            {c.company ? `${c.company} (${c.ticker})` : c.ticker} — {c.title}
          </h2>

          <div className="rounded-lg border border-wall-dark overflow-hidden mb-5 text-sm">
            {c.buys.map((b, i) => (
              <div
                key={i}
                className="flex justify-between px-4 py-2 border-b border-wall last:border-0"
              >
                <span>Buy{b.note ? ` — ${b.note}` : ""}</span>
                <span className="text-ink-soft">{fmtTimestamp(b.date)}</span>
                <span>
                  ${b.price.toFixed(2)} × {b.shares}
                </span>
              </div>
            ))}
            {c.sell && (
              <div className="flex justify-between px-4 py-2 bg-wall/70 font-semibold">
                <span>Sold{c.sell.note ? ` — ${c.sell.note}` : ""}</span>
                <span className="text-ink-soft">{fmtTimestamp(c.sell.date)}</span>
                <span>${c.sell.price.toFixed(2)}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1 px-4 py-2 text-ink-soft border-t border-wall">
              <span>Avg cost ${avgCost.toFixed(2)}</span>
              <span>
                {c.status === "open" ? "Last close" : "Exit"}{" "}
                {perf?.currentPrice != null ? `$${perf.currentPrice.toFixed(2)}` : "—"}
                {perf?.asOf ? ` (${fmtDate(perf.asOf)})` : ""}
              </span>
              <span>
                Chapter <PctCell v={perf?.returnPct ?? null} />
              </span>
              <span>
                SPY same window <PctCell v={perf?.spyReturnPct ?? null} />
              </span>
            </div>
          </div>

          {c.exitTest && (
            <p className="border-l-4 border-tape pl-4 italic text-ink-soft mb-5">
              The exit test, written on day one: &ldquo;{c.exitTest}&rdquo;
            </p>
          )}

          {c.proofs.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs uppercase tracking-wide text-ink-soft mb-2">
                Broker record
              </h3>
              <div className="flex flex-wrap gap-3">
                {c.proofs.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p}
                    src={p}
                    alt={`Broker record for chapter ${c.chapter}`}
                    className="max-h-56 rounded border border-wall-dark"
                  />
                ))}
              </div>
            </div>
          )}

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
      <p className="mt-8 text-sm text-ink-soft">
        Title: Thomas Phelps. Tagline: Paul Samuelson. Sitting: me.
      </p>
    </div>
  );

  return (
    <main className="py-10 sm:py-14">
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
      <h3 className="text-xs uppercase tracking-wide text-ink-soft mb-2">{title}</h3>
      <div className="rounded-lg border border-wall-dark overflow-hidden text-sm">
        {chapters.map((c) => {
          const perf = scoreboard.chapterPerfs.get(c.chapter);
          return (
            <div
              key={c.slug}
              className="flex items-center justify-between gap-3 px-4 py-2 border-b border-wall last:border-0"
            >
              <span className="whitespace-nowrap">
                Ch. {c.chapter} · <b>{c.ticker}</b>
              </span>
              <span className="text-ink-soft truncate">{fmtDate(firstBuyDate(c))}</span>
              <span className="whitespace-nowrap">
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
