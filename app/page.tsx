import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { loadChapters, loadPreface, costBasis, firstBuyDate } from "@/lib/chapters";
import { getScoreboard } from "@/lib/quotes";
import { marked } from "marked";

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

export default async function Home() {
  const chapters = loadChapters();
  const preface = loadPreface();
  const scoreboard = await getScoreboard(chapters);
  const open = chapters.filter((c) => c.status === "open");
  const closed = chapters.filter((c) => c.status === "closed");
  const hasPhoto = fs.existsSync(path.join(process.cwd(), "public", "sitting.jpg"));

  return (
    <main>
      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-14 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
          Buy Right Sit Tight
        </h1>
        <p className="mt-4 text-xl text-ink-soft italic">watch the paint dry.</p>

        <div className="mt-10">
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/sitting.jpg"
              alt="The author, sitting in a chair, watching paint dry"
              className="mx-auto rounded-lg shadow-md max-h-[420px]"
            />
          ) : (
            <div className="mx-auto max-w-md rounded-lg border-2 border-dashed border-wall-dark bg-wall-dark/40 px-8 py-16 text-ink-soft text-sm">
              [ Photo goes here: a man, a folding chair, a half-painted wall,
              a mug. Save it as <code>public/sitting.jpg</code>. ]
            </div>
          )}
        </div>

        <p className="mt-10 text-lg leading-relaxed">
          This is a live book. Every stock I buy with my own money opens a new
          chapter — timestamped the day it happens. A chapter only closes when I
          sell. Most of them, I hope, will stay open for a very long time.
        </p>
      </section>

      {/* The pledge */}
      <section className="mx-auto max-w-3xl px-6 pb-14">
        <div className="rounded-lg border-l-4 border-tape bg-white px-6 py-5 shadow-sm">
          <h2 className="font-bold text-lg mb-2">The pledge</h2>
          <p className="leading-relaxed">
            Every real-money stock purchase I make appears here within 24 hours.
            No exceptions, no deletions. Chapters are never edited after
            publication — corrections are appended, dated, below the original.
            Every chapter states, on the day I buy, what would make me sell.
          </p>
        </div>
      </section>

      {/* Scoreboard */}
      <section className="mx-auto max-w-3xl px-6 pb-14">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-white px-6 py-5 shadow-sm text-center">
            <div className="text-sm text-ink-soft uppercase tracking-wide">The book</div>
            <div className="text-3xl mt-1">
              <PctCell v={scoreboard.totalReturnPct} />
            </div>
          </div>
          <div className="rounded-lg bg-white px-6 py-5 shadow-sm text-center">
            <div className="text-sm text-ink-soft uppercase tracking-wide">
              S&amp;P 500, same money, same days
            </div>
            <div className="text-3xl mt-1">
              <PctCell v={scoreboard.spyReturnPct} />
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm text-ink-soft text-center">
          Cost-weighted across all chapters, each measured from its own buy date.
          Prices refresh hourly.
        </p>
      </section>

      {/* Table of contents = the portfolio */}
      <section className="mx-auto max-w-3xl px-6 pb-14">
        <h2 className="text-2xl font-bold mb-6">Table of contents</h2>

        {chapters.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-wall-dark px-8 py-14 text-center text-ink-soft">
            <p className="text-lg">Chapter 1 hasn&apos;t happened yet.</p>
            <p className="mt-2 text-sm">
              The first buy opens the first chapter. Until then — the wall is
              still being painted.
            </p>
          </div>
        )}

        {open.length > 0 && (
          <>
            <h3 className="text-sm uppercase tracking-wide text-ink-soft mb-3">
              Still drying — open chapters ({open.length})
            </h3>
            <ChapterTable chapters={open} scoreboard={scoreboard} />
          </>
        )}

        {closed.length > 0 && (
          <>
            <h3 className="text-sm uppercase tracking-wide text-ink-soft mb-3 mt-10">
              Dry — closed chapters ({closed.length})
            </h3>
            <ChapterTable chapters={closed} scoreboard={scoreboard} />
          </>
        )}
      </section>

      {/* Preface */}
      {preface && (
        <section className="mx-auto max-w-3xl px-6 pb-6">
          <h2 className="text-2xl font-bold mb-4">Preface</h2>
          <article
            className="prose-book"
            dangerouslySetInnerHTML={{ __html: marked.parse(preface) as string }}
          />
        </section>
      )}
    </main>
  );
}

function ChapterTable({
  chapters,
  scoreboard,
}: {
  chapters: ReturnType<typeof loadChapters>;
  scoreboard: Awaited<ReturnType<typeof getScoreboard>>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-wall-dark text-ink-soft">
            <th className="px-4 py-3 font-normal">Ch.</th>
            <th className="px-4 py-3 font-normal">Ticker</th>
            <th className="px-4 py-3 font-normal">Title</th>
            <th className="px-4 py-3 font-normal">First buy</th>
            <th className="px-4 py-3 font-normal text-right">Cost</th>
            <th className="px-4 py-3 font-normal text-right">Return</th>
            <th className="px-4 py-3 font-normal text-right">SPY same window</th>
          </tr>
        </thead>
        <tbody>
          {chapters.map((c) => {
            const perf = scoreboard.chapterPerfs.get(c.chapter);
            return (
              <tr key={c.slug} className="border-b border-wall last:border-0">
                <td className="px-4 py-3">{c.chapter}</td>
                <td className="px-4 py-3 font-bold">{c.ticker}</td>
                <td className="px-4 py-3">
                  <Link href={`/chapter/${c.slug}`} className="text-tape underline">
                    {c.title}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {fmtDate(firstBuyDate(c))}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  ${costBasis(c).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-right">
                  <PctCell v={perf?.returnPct ?? null} />
                </td>
                <td className="px-4 py-3 text-right">
                  <PctCell v={perf?.spyReturnPct ?? null} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
