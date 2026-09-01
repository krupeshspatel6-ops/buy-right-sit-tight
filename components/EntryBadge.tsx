import Link from "next/link";
import { entryMeta, type EntryKind } from "@/lib/entry-source";

// A small pill that credits how a trade started (code signal / copycat /
// manual). Links to "The Code" so a curious reader can learn what the code is.
//
// Variants:
//   "opener" — sits on the dark-blue chapter opener (light, translucent pill)
//   "row"    — compact pill for the table-of-contents rows (on white)
//   "plain"  — default pill on a light surface (chapter permalink header)
export default function EntryBadge({
  kind,
  note,
  variant = "plain",
  link = true,
}: {
  kind?: EntryKind;
  note?: string;
  variant?: "opener" | "row" | "plain";
  link?: boolean;
}) {
  if (!kind) return null;
  const m = entryMeta(kind, note);
  const text = variant === "row" ? m.short : m.label;

  const base =
    "font-grotesk inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wide";
  const byVariant =
    variant === "opener"
      ? "border border-white/30 bg-white/15 px-2.5 py-0.5 text-[11px] text-white"
      : variant === "row"
        ? "shrink-0 bg-ink/5 px-2 py-0.5 text-[10px] text-ink-soft"
        : "border border-wall-dark bg-white px-2.5 py-0.5 text-[11px] text-ink-soft";

  const content = (
    <span className={`${base} ${byVariant}`}>
      <span aria-hidden>{m.emoji}</span>
      {text}
    </span>
  );

  if (!link) return content;
  return (
    <Link href="/the-code" title="What is “the code”?" className="no-underline">
      {content}
    </Link>
  );
}
