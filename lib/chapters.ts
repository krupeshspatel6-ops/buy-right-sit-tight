import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type Buy = {
  date: string; // ISO timestamp of the actual fill
  price: number;
  shares: number;
  note?: string;
};

export type Sell = {
  date: string;
  price: number;
  note?: string;
};

export type Chapter = {
  slug: string;
  chapter: number;
  title: string;
  ticker: string;
  status: "open" | "closed";
  buys: Buy[];
  sell?: Sell;
  exitTest: string;
  body: string;
};

const CHAPTERS_DIR = path.join(process.cwd(), "chapters");

// YAML parses ISO timestamps into Date objects; normalize back to strings.
function isoString(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

// Files starting with "_" (templates) or "00-" (preface) are not stock chapters.
function isChapterFile(f: string): boolean {
  return f.endsWith(".md") && !f.startsWith("_") && !f.startsWith("00-");
}

export function loadChapters(): Chapter[] {
  if (!fs.existsSync(CHAPTERS_DIR)) return [];
  const chapters = fs
    .readdirSync(CHAPTERS_DIR)
    .filter(isChapterFile)
    .map((file) => {
      const raw = fs.readFileSync(path.join(CHAPTERS_DIR, file), "utf8");
      const { data, content } = matter(raw);
      const c: Chapter = {
        slug: file.replace(/\.md$/, ""),
        chapter: Number(data.chapter),
        title: String(data.title ?? ""),
        ticker: String(data.ticker ?? "").toUpperCase(),
        status: data.sell ? "closed" : "open",
        buys: ((data.buys ?? []) as Buy[]).map((b) => ({
          ...b,
          date: isoString(b.date),
        })),
        sell: data.sell
          ? { ...(data.sell as Sell), date: isoString((data.sell as Sell).date) }
          : undefined,
        exitTest: String(data.exitTest ?? ""),
        body: content.trim(),
      };
      return c;
    })
    .filter((c) => Number.isFinite(c.chapter) && c.ticker && c.buys.length > 0);
  return chapters.sort((a, b) => a.chapter - b.chapter);
}

export function getChapter(slug: string): Chapter | undefined {
  return loadChapters().find((c) => c.slug === slug);
}

export function loadPreface(): string | null {
  const p = path.join(CHAPTERS_DIR, "00-preface.md");
  if (!fs.existsSync(p)) return null;
  const { content } = matter(fs.readFileSync(p, "utf8"));
  return content.trim();
}

export function costBasis(c: Chapter): number {
  return c.buys.reduce((sum, b) => sum + b.price * b.shares, 0);
}

export function totalShares(c: Chapter): number {
  return c.buys.reduce((sum, b) => sum + b.shares, 0);
}

export function firstBuyDate(c: Chapter): string {
  return c.buys.map((b) => b.date).sort()[0];
}
