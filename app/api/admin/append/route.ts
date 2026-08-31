import { NextResponse } from "next/server";
import { appendBuyToFile, appendNoteToFile } from "@/lib/chapter-file";
import { getFileFromGitHub, updateFileOnGitHub, triggerVercelDeploy } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth is enforced by proxy.ts. APPEND-ONLY: this route can only ADD an add-on
// buy and/or a dated note to an existing chapter. It never rewrites the original
// content — the server does the appending, so the published text can't be edited.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    slug?: string;
    buy?: { date?: string; price?: number; shares?: number; note?: string };
    note?: string;
    deploy?: boolean;
  };
  const slug = String(body.slug || "").replace(/[^a-z0-9-]/g, "");
  if (!slug) return NextResponse.json({ ok: false, error: "Pick a chapter." }, { status: 400 });

  const hasBuy =
    body.buy &&
    Number.isFinite(Number(body.buy.price)) &&
    Number(body.buy.price) > 0 &&
    Number.isFinite(Number(body.buy.shares)) &&
    Number(body.buy.shares) > 0 &&
    String(body.buy.date || "").trim();
  const noteText = String(body.note || "").trim();
  if (!hasBuy && !noteText) {
    return NextResponse.json(
      { ok: false, error: "Add an add-on buy, a note, or both." },
      { status: 400 }
    );
  }

  const relPath = `chapters/${slug}.md`;
  const file = await getFileFromGitHub(relPath);
  if (!file.ok) {
    return NextResponse.json(
      { ok: false, error: `Couldn't load that chapter (${file.error}).` },
      { status: 404 }
    );
  }

  let content = file.content;
  const summary: string[] = [];
  if (hasBuy && body.buy) {
    content = appendBuyToFile(content, {
      date: String(body.buy.date),
      price: Number(body.buy.price),
      shares: Number(body.buy.shares),
      note: body.buy.note ? String(body.buy.note) : "added on",
    });
    summary.push(`add-on buy ${body.buy.shares} @ $${body.buy.price}`);
  }
  if (noteText) {
    const label = new Date(hasBuy ? String(body.buy!.date) : Date.now()).toLocaleDateString(
      "en-US",
      { year: "numeric", month: "short", day: "numeric" }
    );
    content = appendNoteToFile(content, noteText, label);
    summary.push("a dated note");
  }

  const commit = await updateFileOnGitHub(
    relPath,
    content,
    file.sha,
    `Append to ${slug}: ${summary.join(" + ")}`
  );
  if (!commit.ok) {
    return NextResponse.json({ ok: false, error: commit.error }, { status: 502 });
  }

  const deployed = body.deploy !== false ? await triggerVercelDeploy() : false;
  return NextResponse.json({ ok: true, slug, appended: summary, deployed });
}
