import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { isAdminEnabled } from "@/lib/admin";
import { buildChapterFile, chapterSlug, type ChapterFileInput } from "@/lib/chapter-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, stdio: "pipe", timeout: 600_000 }).toString();
}

export async function POST(req: Request) {
  if (!isAdminEnabled()) {
    return NextResponse.json(
      { ok: false, error: "The admin editor only runs locally, never on the deployed site." },
      { status: 403 }
    );
  }

  let input: (ChapterFileInput & { dry?: boolean; deploy?: boolean }) | null = null;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request body." }, { status: 400 });
  }
  if (!input) return NextResponse.json({ ok: false, error: "No data." }, { status: 400 });

  // Validate the essentials.
  const errors: string[] = [];
  const chapter = Number(input.chapter);
  const ticker = String(input.ticker || "").toUpperCase().replace(/[^A-Z.]/g, "");
  const price = Number(input.price);
  const shares = Number(input.shares);
  if (!Number.isInteger(chapter) || chapter < 1) errors.push("Chapter number must be a positive integer.");
  if (!ticker) errors.push("Ticker is required.");
  if (!Number.isFinite(price) || price <= 0) errors.push("Price must be greater than 0.");
  if (!Number.isFinite(shares) || shares <= 0) errors.push("Shares must be greater than 0.");
  if (!String(input.date || "").trim()) errors.push("Fill date is required.");
  if (!String(input.body || "").trim()) errors.push("Write the 'why' before publishing.");
  if (errors.length) return NextResponse.json({ ok: false, error: errors.join(" ") }, { status: 400 });

  const fileText = buildChapterFile({
    chapter,
    title: input.title,
    ticker,
    company: input.company,
    date: input.date,
    price,
    shares,
    note: input.note,
    proofs: input.proofs,
    exitTest: input.exitTest,
    body: input.body,
  });

  // Dry run: just return the built file for preview, touch nothing.
  if (input.dry) {
    return NextResponse.json({ ok: true, dry: true, fileText });
  }

  const root = process.cwd();
  const slug = chapterSlug(chapter, ticker);
  const relPath = path.join("chapters", `${slug}.md`);
  const filePath = path.join(root, relPath);

  // Never overwrite a published chapter — the pledge is that nothing is edited.
  if (fs.existsSync(filePath)) {
    return NextResponse.json(
      { ok: false, error: `chapters/${slug}.md already exists. Published chapters are never overwritten.` },
      { status: 409 }
    );
  }

  const log: string[] = [];
  try {
    fs.writeFileSync(filePath, fileText, "utf8");
    log.push(`Wrote ${relPath}`);

    run(`git add "${filePath}"`, root);
    const company = input.company ? ` (${input.company})` : "";
    const msg = `Chapter ${chapter}: ${ticker}${company} — ${input.title || "Untitled"}`.replace(/"/g, "'");
    run(`git commit -m "${msg}"`, root);
    log.push("Committed to git");
    run(`git push`, root);
    log.push("Pushed to GitHub (public, timestamped commit)");

    let prodUrl: string | null = null;
    if (input.deploy !== false) {
      const out = run(`npx vercel deploy --prod --yes`, root);
      const m = out.match(/https:\/\/[^\s]+\.vercel\.app/);
      prodUrl = m ? m[0] : null;
      log.push("Deployed to production");
    }

    return NextResponse.json({ ok: true, slug, prodUrl, log });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: `Publish step failed: ${detail}`, log },
      { status: 500 }
    );
  }
}
