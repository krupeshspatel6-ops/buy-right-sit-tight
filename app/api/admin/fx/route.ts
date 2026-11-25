import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live FX for the admin preview: native units per 1 USD (e.g. USD/TRY).
// Auth is enforced by middleware.ts before this route runs.
export async function GET(req: Request) {
  const cur =
    (new URL(req.url).searchParams.get("currency") || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!cur || cur === "USD") return NextResponse.json({ rate: 1 });
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/USD${cur}=X?range=5d&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    );
    const j = await r.json();
    const p = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return NextResponse.json({ rate: Number(p) > 0 ? Number(p) : null });
  } catch {
    return NextResponse.json({ rate: null });
  }
}
