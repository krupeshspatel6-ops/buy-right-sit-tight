// How a trade started — the single source of truth for the "entry source" of a
// chapter. Most buys here begin with a signal from a small system Krupesh built
// ("the code"); some are copycat trades (following an investor he admires); a
// few are his own manual conviction. We surface this on every chapter so the
// code gets visible, repeated credit — and, because every chapter is
// timestamped and never edited, the code quietly accrues a public track record.
//
// Honesty guardrail: this is a label on an honest experiment, NOT a signal
// service. Never phrase it as "a code that beats the market" or invite anyone
// to follow the signals. The record speaks; the code is just how a buy began.

export type EntryKind = "code" | "copycat" | "manual";

export const ENTRY_KINDS: EntryKind[] = ["code", "copycat", "manual"];

export type EntryMeta = {
  kind: EntryKind;
  emoji: string;
  /** Full label, e.g. "Signal from the code" or "Copycat — Pabrai". */
  label: string;
  /** Compact label for tight rows, e.g. "Code signal". */
  short: string;
};

export function isEntryKind(v: unknown): v is EntryKind {
  return typeof v === "string" && (ENTRY_KINDS as string[]).includes(v);
}

// `note` refines a copycat trade ("Pabrai") or adds a short qualifier.
export function entryMeta(kind: EntryKind, note?: string): EntryMeta {
  const n = (note || "").trim();
  switch (kind) {
    case "code":
      return { kind, emoji: "⚡", label: "Signal from the code", short: "Code signal" };
    case "copycat":
      return {
        kind,
        emoji: "🧭",
        label: n ? `Copycat — ${n}` : "Copycat trade",
        short: n ? `Copycat — ${n}` : "Copycat",
      };
    case "manual":
      return { kind, emoji: "✋", label: "My own conviction", short: "Manual" };
  }
}
