// Daily close prices from Yahoo Finance's public chart API (free, no key).
// Used to score each chapter against SPY from its first buy date. If the
// API is unreachable the site still renders — performance cells show "—".

import { Chapter, costBasis, firstBuyDate, totalShares } from "./chapters";

type Daily = { date: string; close: number };

async function fetchDaily(symbol: string): Promise<Daily[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol.toUpperCase()
    )}?range=10y&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const ts: number[] = result?.timestamp ?? [];
    const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close ?? [];
    const rows: Daily[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (typeof c === "number" && Number.isFinite(c)) {
        rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: c });
      }
    }
    return rows;
  } catch {
    return [];
  }
}

function closeOnOrAfter(rows: Daily[], isoDate: string): number | null {
  const day = isoDate.slice(0, 10);
  const row = rows.find((r) => r.date >= day);
  return row ? row.close : null;
}

function closeOnOrBefore(rows: Daily[], isoDate: string): number | null {
  const day = isoDate.slice(0, 10);
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].date <= day) return rows[i].close;
  }
  return null;
}

export type ChapterPerf = {
  currentPrice: number | null;
  returnPct: number | null; // chapter return since (weighted) cost basis
  spyReturnPct: number | null; // SPY over the same window
  asOf: string | null; // date (YYYY-MM-DD) of the close behind currentPrice
};

export async function getChapterPerf(c: Chapter): Promise<ChapterPerf> {
  const [stock, spy] = await Promise.all([fetchDaily(c.ticker), fetchDaily("spy")]);
  const start = firstBuyDate(c);
  const end = c.sell?.date;

  const avgCost = costBasis(c) / totalShares(c);
  const lastRow = stock.length ? stock[stock.length - 1] : null;
  const exitPrice = c.sell ? c.sell.price : lastRow ? lastRow.close : null;
  const asOf = c.sell ? c.sell.date.slice(0, 10) : lastRow ? lastRow.date : null;

  const spyStart = closeOnOrAfter(spy, start);
  const spyEnd = end
    ? closeOnOrBefore(spy, end)
    : spy.length
      ? spy[spy.length - 1].close
      : null;

  return {
    currentPrice: exitPrice,
    returnPct: exitPrice !== null ? ((exitPrice - avgCost) / avgCost) * 100 : null,
    spyReturnPct:
      spyStart !== null && spyEnd !== null ? ((spyEnd - spyStart) / spyStart) * 100 : null,
    asOf,
  };
}

export type Scoreboard = {
  totalReturnPct: number | null; // cost-weighted across all chapters
  spyReturnPct: number | null; // SPY cost-weighted over the same windows
  // The dollar-matched head-to-head: every dollar put in a pick is mirrored by
  // the same dollar in the S&P 500 on the same day. These are the running
  // totals of both sides (null until at least one chapter can be scored).
  invested: number; // total dollars put into picks (= same dollars shadowed into SPY)
  picksValue: number | null; // what the picks are worth now
  spyValue: number | null; // what the same money in the S&P would be worth now
  chapterPerfs: Map<number, ChapterPerf>;
};

export async function getScoreboard(chapters: Chapter[]): Promise<Scoreboard> {
  const perfs = await Promise.all(chapters.map((c) => getChapterPerf(c)));
  const chapterPerfs = new Map<number, ChapterPerf>();
  chapters.forEach((c, i) => chapterPerfs.set(c.chapter, perfs[i]));

  let cost = 0;
  let value = 0;
  let spyCost = 0;
  let spyValue = 0;
  chapters.forEach((c, i) => {
    const p = perfs[i];
    const basis = costBasis(c);
    if (p.returnPct !== null) {
      cost += basis;
      value += basis * (1 + p.returnPct / 100);
    }
    if (p.spyReturnPct !== null) {
      spyCost += basis;
      spyValue += basis * (1 + p.spyReturnPct / 100);
    }
  });

  return {
    totalReturnPct: cost > 0 ? ((value - cost) / cost) * 100 : null,
    spyReturnPct: spyCost > 0 ? ((spyValue - spyCost) / spyCost) * 100 : null,
    invested: cost,
    picksValue: cost > 0 ? value : null,
    // Scored on the same dollars/windows as the picks, so the two sides are
    // directly comparable even when SPY data is missing for some chapters.
    spyValue: cost > 0 ? spyValue + (cost - spyCost) : null,
    chapterPerfs,
  };
}
