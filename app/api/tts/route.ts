import { NextResponse } from "next/server";
import { getClientIp, ipRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The buddy's voice — OpenAI gpt-4o-mini-tts "coral", the same warm neural
// voice copycat.tools uses. Off until OPENAI_API_KEY is set (it costs money
// per line, and this is public), with a soft per-browser rate limit.
export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "voice not configured" }, { status: 503 });
  }

  // Per-IP ceiling (survives cookie-clearing), generous for shared IPs.
  if (!ipRateLimit(`tts:${getClientIp(req)}`, 200, 3_600_000)) {
    return NextResponse.json({ ok: false, error: "voice rate limit" }, { status: 429 });
  }

  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/brst_tts=(\d+)\.(\d+)/);
  const now = Date.now();
  let n = 0;
  let resetAt = now + 3_600_000;
  if (m) {
    n = parseInt(m[1], 10) || 0;
    resetAt = parseInt(m[2], 10) || resetAt;
    if (now > resetAt) {
      n = 0;
      resetAt = now + 3_600_000;
    }
  }
  if (n >= 100) {
    return NextResponse.json({ ok: false, error: "voice rate limit" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const input = String(body.text || "").slice(0, 800);
  if (!input.trim()) return NextResponse.json({ ok: false, error: "no text" }, { status: 400 });

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: process.env.BUDDY_VOICE || "coral",
      input,
      instructions:
        "Speak warmly and casually, like a friendly, upbeat person talking to someone they just met — natural pacing and intonation, real human energy, never robotic or like reading a script.",
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return NextResponse.json({ ok: false, error: `tts failed (${res.status})`, detail: t.slice(0, 200) }, { status: 502 });
  }

  const audio = Buffer.from(await res.arrayBuffer());
  const out = new NextResponse(audio, {
    status: 200,
    headers: { "content-type": "audio/mpeg", "cache-control": "no-store" },
  });
  out.cookies.set("brst_tts", `${n + 1}.${resetAt}`, { path: "/", maxAge: 3600, sameSite: "lax" });
  return out;
}
