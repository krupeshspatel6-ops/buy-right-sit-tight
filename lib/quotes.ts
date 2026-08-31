// Daily close prices from Yahoo Finance's public chart API (free, no key).
// Used to score each chapter against SPY from its first buy date. If the
// API is unreachable the site still renders — performance cells show "—".

import { Chapter, costBasis, firstBuyDate, totalShares } from "./chapters";

type Daily = { date: string; open: number; high: number; low: number; close: number };

async function fetchDaily(symbol: string): Promise<Daily[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol.toUpperCase()
    )}?range=10y&interval=1d`;
    // Same URL for perf + candles → Next dedupes the request within a render.
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const ts: number[] = result?.timestamp ?? [];
    const q = result?.indicators?.quote?.[0] ?? {};
    const opens: Array<number | null> = q.open ?? [];
    const highs: Array<number | null> = q.high ?? [];
    const lows: Array<number | null> = q.low ?? [];
    const closes: Array<number | null> = q.close ?? [];
    const rows: Daily[] = [];
    for (let i = 0; i < ts.length; i++) {
      const o = opens[i], h = highs[i], l = lows[i], c = closes[i];
      if ([o, h, l, c].every((v) => typeof v === "number" && Number.isFinite(v))) {
        rows.push({
          date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
          open: o as number,
          high: h as number,
          low: l as number,
          close: c as number,
        });
      }
    }
    return rows;
  } catch {
    return [];
  }
}

export type Candle = { t: string; o: number; h: number; l: number; c: number };
export type ChapterChart = {
  candles: Candle[];
  buyDate: string;
  buyPrice: number; // (weighted) cost basis per share
  period: "day" | "week" | "month";
  sell?: { date: string; price: number };
};

// Which calendar bucket a date falls in, so candles align to real periods:
// daily (end-of-day) for short/recent holds, then weekly, then monthly as the
// hold gets longer — so an open chapter's chart stays readable for years.
function periodKey(date: string, period: "day" | "week" | "month"): string {
  if (period === "day") return date;
  if (period === "month") return date.slice(0, 7); // YYYY-MM
  const d = new Date(date + "T00:00:00Z");
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // back to Monday
  return monday.toISOString().slice(0, 10);
}

// OHLC candles for a chapter, from the buy date to the sell date (or today).
// Open chapters extend live: each revalidate pulls fresh end-of-day data, so
// new candles append on their own.
export async function getChapterCandles(c: Chapter): Promise<ChapterChart | null> {
  const rows = await fetchDaily(c.ticker);
  if (rows.length < 2) return null;
  const start = firstBuyDate(c).slice(0, 10);
  const end = c.sell?.date.slice(0, 10);
  const daily = rows.filter((r) => r.date >= start && (!end || r.date <= end));
  if (daily.length < 2) return null;

  const spanDays =
    (Date.parse(daily[daily.length - 1].date) - Date.parse(daily[0].date)) / 86_400_000;
  const period: "day" | "week" | "month" =
    spanDays <= 120 ? "day" : spanDays <= 900 ? "week" : "month";

  // group consecutive days into their period, aggregating OHLC
  const candles: Candle[] = [];
  let bucketKey = "";
  for (const r of daily) {
    const key = periodKey(r.date, period);
    if (key !== bucketKey) {
      candles.push({ t: r.date, o: r.open, h: r.high, l: r.low, c: r.close });
      bucketKey = key;
    } else {
      const cur = candles[candles.length - 1];
      cur.h = Math.max(cur.h, r.high);
      cur.l = Math.min(cur.l, r.low);
      cur.c = r.close; // last close in the period
    }
  }
  if (candles.length < 2) return null;

  return {
    candles,
    buyDate: start,
    buyPrice: costBasis(c) / totalShares(c),
    period,
    sell: c.sell ? { date: c.sell.date.slice(0, 10), price: c.sell.price } : undefined,
  };
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

// The matched S&P 500 side is bought as VOO (Vanguard's low-cost S&P 500 fund).
// VOO and SPY track the same index; VOO fits the buy-and-hold ethos.
export async function getChapterPerf(c: Chapter): Promise<ChapterPerf> {
  const [stock, spy] = await Promise.all([fetchDaily(c.ticker), fetchDaily("voo")]);
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
  // a real dollar in the S&P 500 the same day. These are the running totals of
  // both real sides (null until at least one chapter can be scored).
  invested: number; // dollars in picks (the same amount is also really in the S&P)
  picksValue: number | null; // what the picks are worth now
  spyValue: number | null; // what the matched S&P money is worth now
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
