// Timezone-safe formatting. We never run the recorded time through the
// runtime's clock (which would show UTC on Vercel) — we read the wall-clock
// components straight from the ISO string, so a fill always displays exactly
// as it was recorded and matches the broker screenshot.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Parsed = {
  y: number;
  mo: number;
  d: number;
  h: number | null;
  mi: number;
  offset: string | null;
};

function parseIso(iso: string): Parsed | null {
  const m = String(iso).match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::\d{2})?(Z|[+-]\d{2}:\d{2})?)?/
  );
  if (!m) return null;
  return {
    y: +m[1],
    mo: +m[2],
    d: +m[3],
    h: m[4] != null ? +m[4] : null,
    mi: m[5] != null ? +m[5] : 0,
    offset: m[6] ?? null,
  };
}

function zoneLabel(offset: string | null): string {
  if (!offset || offset === "Z") return "UTC";
  // US Eastern (the market's zone) covers both EST (-05) and EDT (-04).
  if (offset === "-05:00" || offset === "-04:00") return "ET";
  const sign = offset[0];
  const hh = parseInt(offset.slice(1, 3), 10);
  const mm = parseInt(offset.slice(4, 6), 10);
  return `UTC${sign}${hh}${mm ? ":" + String(mm).padStart(2, "0") : ""}`;
}

/** "Feb 3, 2026, 10:15 AM ET" — the exact wall-clock time as recorded. */
export function formatFillTime(iso: string): string {
  const p = parseIso(iso);
  if (!p) return "—";
  const date = `${MONTHS[p.mo - 1]} ${p.d}, ${p.y}`;
  if (p.h == null) return date;
  let hr = p.h % 12;
  if (hr === 0) hr = 12;
  const ampm = p.h < 12 ? "AM" : "PM";
  return `${date}, ${hr}:${String(p.mi).padStart(2, "0")} ${ampm} ${zoneLabel(p.offset)}`;
}

/** "Feb 3, 2026" from an ISO or YYYY-MM-DD string, with no timezone drift. */
export function formatDate(dateStr: string): string {
  const p = parseIso(dateStr);
  if (!p) return "—";
  return `${MONTHS[p.mo - 1]} ${p.d}, ${p.y}`;
}
