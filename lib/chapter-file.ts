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

export type AddOnBuy = { date: string; price: number; shares: number; note?: string };

// Insert an add-on buy into the `buys:` list WITHOUT touching any existing line
// — the original entries stay byte-identical; we only add new indented lines.
export function appendBuyToFile(original: string, buy: AddOnBuy): string {
  const lines = original.split("\n");
  const buysIdx = lines.findIndex((l) => l.trimEnd() === "buys:");
  if (buysIdx === -1) return original;
  // The buys block runs until the next non-indented, non-blank line (proofs:/exitTest:).
  let end = buysIdx + 1;
  while (end < lines.length && (lines[end].startsWith("  ") || lines[end].trim() === "")) end++;
  // Skip back over any trailing blank lines so the entry sits with the others.
  while (end > buysIdx + 1 && lines[end - 1].trim() === "") end--;
  const entry = [
    `  - date: "${buy.date}"`,
    `    price: ${buy.price}`,
    `    shares: ${buy.shares}`,
    ...(buy.note ? [`    note: ${JSON.stringify(buy.note)}`] : []),
  ];
  lines.splice(end, 0, ...entry);
  return lines.join("\n");
}

// Append a dated update to the bottom of the record — never edits what's above.
export function appendNoteToFile(original: string, note: string, dateLabel: string): string {
  const block = `\n**${dateLabel}** — ${note.trim()}\n`;
  return `${original.replace(/\s+$/, "")}\n${block}`;
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
