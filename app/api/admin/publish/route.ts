import { NextResponse } from "next/server";
import { buildChapterFile, chapterSlug, type ChapterFileInput } from "@/lib/chapter-file";
import { createFileOnGitHub, triggerVercelDeploy } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth is enforced by middleware.ts before this route runs.
export async function POST(req: Request) {
  let input: (ChapterFileInput & { dry?: boolean; deploy?: boolean; logo?: string; domain?: string }) | null =
    null;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request body." }, { status: 400 });
  }
  if (!input) return NextResponse.json({ ok: false, error: "No data." }, { status: 400 });

  const errors: string[] = [];
  const chapter = Number(input.chapter);
  // Keep hyphens and digits so tickers like BRK-B resolve on the price feed.
  const ticker = String(input.ticker || "").toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  const price = Number(input.price);
  const shares = Number(input.shares);
  if (!Number.isInteger(chapter) || chapter < 1) errors.push("Chapter number must be a positive integer.");
  if (!ticker) errors.push("Ticker is required.");
  if (!Number.isFinite(price) || price <= 0) errors.push("Price must be greater than 0.");
  if (!Number.isFinite(shares) || shares <= 0) errors.push("Shares must be greater than 0.");
  if (!String(input.date || "").trim()) errors.push("Fill date is required.");
  if (!String(input.exitTest || "").trim())
    errors.push("The exit plan (what would make you sell) is required — the pledge says every chapter states it on day one.");
  if (!String(input.body || "").trim()) errors.push("Write the 'why' before publishing.");
  if (errors.length) return NextResponse.json({ ok: false, error: errors.join(" ") }, { status: 400 });

  const fileText = buildChapterFile({
    chapter,
    title: input.title,
    ticker,
    company: input.company,
    logo: input.logo,
    domain: input.domain,
    date: input.date,
    price,
    shares,
    note: input.note,
    proofs: input.proofs,
    exitTest: input.exitTest,
    body: input.body,
  });

  if (input.dry) return NextResponse.json({ ok: true, dry: true, fileText });

  const slug = chapterSlug(chapter, ticker);
  const relPath = `chapters/${slug}.md`;
  const company = input.company ? ` (${input.company})` : "";
  const message = `Chapter ${chapter}: ${ticker}${company} — ${input.title || "Untitled"}`;

  const commit = await createFileOnGitHub(relPath, fileText, message);
  if (!commit.ok) {
    const status = commit.code === "exists" ? 409 : commit.code === "config" ? 503 : 502;
    return NextResponse.json({ ok: false, error: commit.error }, { status });
  }

  const deployed = input.deploy !== false ? await triggerVercelDeploy() : false;
  return NextResponse.json({ ok: true, slug, committed: true, deployed, sha: commit.sha });
}
