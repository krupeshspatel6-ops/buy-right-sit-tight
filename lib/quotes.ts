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
};

export async function getChapterPerf(c: Chapter): Promise<ChapterPerf> {
  const [stock, spy] = await Promise.all([fetchDaily(c.ticker), fetchDaily("spy")]);
  const start = firstBuyDate(c);
  const end = c.sell?.date;

  const avgCost = costBasis(c) / totalShares(c);
  const exitPrice = c.sell
    ? c.sell.price
    : stock.length
      ? stock[stock.length - 1].close
      : null;

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
  };
}

export type Scoreboard = {
  totalReturnPct: number | null; // cost-weighted across all chapters
  spyReturnPct: number | null; // SPY cost-weighted over the same windows
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
    chapterPerfs,
  };
}
