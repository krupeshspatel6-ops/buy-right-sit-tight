// Builds a chapter markdown file from structured input — the same format as
// chapters/_TEMPLATE.md. Shared by the admin publish route.

export type ChapterFileInput = {
  chapter: number;
  title: string;
  ticker: string;
  company?: string;
  logo?: string;
  domain?: string;
  date: string; // ISO 8601 with offset
  price: number;
  shares: number;
  note?: string;
  proofs?: string[];
  exitTest: string;
  body: string;
};

export function chapterSlug(chapter: number, ticker: string): string {
  const t = ticker.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${String(chapter).padStart(2, "0")}-${t}`;
}

export function buildChapterFile(i: ChapterFileInput): string {
  const proofs = (i.proofs ?? []).filter(Boolean);
  return [
    "---",
    `chapter: ${i.chapter}`,
    `title: ${JSON.stringify(i.title || "Untitled")}`,
    `ticker: ${i.ticker.toUpperCase()}`,
    ...(i.company ? [`company: ${JSON.stringify(i.company)}`] : []),
    ...(i.logo ? [`logo: ${JSON.stringify(i.logo)}`] : []),
    ...(i.domain ? [`domain: ${JSON.stringify(i.domain)}`] : []),
    "buys:",
    `  - date: "${i.date}"`,
    `    price: ${i.price}`,
    `    shares: ${i.shares}`,
    ...(i.note ? [`    note: ${JSON.stringify(i.note)}`] : []),
    ...(proofs.length ? ["proofs:", ...proofs.map((p) => `  - ${p}`)] : []),
    `exitTest: ${JSON.stringify(i.exitTest || "TODO: write what would make you sell.")}`,
    "---",
    "",
    i.body.trim() || "TODO: write why you bought this.",
    "",
    "> The record continues below this line — append-only, each entry dated.",
    "> The original text above is never touched. Quarterly checks, splits,",
    "> dividends, and any options hedge on this position go here.",
    "",
  ].join("\n");
}
