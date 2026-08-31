import { NextResponse } from "next/server";
import { createBinaryFileOnGitHub, triggerVercelDeploy } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth is enforced by proxy.ts before this route runs.
// Accepts a base64 image data URL, commits it to public/proofs/ on GitHub, and
// returns the site path to reference from a chapter.
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    dataUrl?: string;
    chapter?: number;
  };
  const dataUrl = String(body.dataUrl || "");
  const m = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) {
    return NextResponse.json(
      { ok: false, error: "Please choose a PNG, JPG, WEBP, or GIF image." },
      { status: 400 }
    );
  }
  const mime = m[1];
  const base64 = m[2];
  // ~7MB cap (base64 is ~1.33x the byte size)
  if (base64.length > 7_000_000) {
    return NextResponse.json(
      { ok: false, error: "That image is too large — keep it under 5 MB." },
      { status: 413 }
    );
  }

  const ext = EXT[mime] || "png";
  const chapter = Number.isFinite(Number(body.chapter)) ? Number(body.chapter) : 0;
  // Unique, non-guessable-ish filename; chapter prefix for tidiness.
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const name = `ch${String(chapter).padStart(2, "0")}-${stamp}${rand}.${ext}`;
  const relPath = `public/proofs/${name}`;

  const commit = await createBinaryFileOnGitHub(
    relPath,
    base64,
    `Proof image for chapter ${chapter || "?"}: ${name}`
  );
  if (!commit.ok) {
    const status = commit.code === "config" ? 503 : commit.code === "exists" ? 409 : 502;
    return NextResponse.json({ ok: false, error: commit.error }, { status });
  }

  const deployed = await triggerVercelDeploy();
  return NextResponse.json({ ok: true, path: `/proofs/${name}`, deployed });
}
