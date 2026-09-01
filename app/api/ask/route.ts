import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadChapters, loadPreface } from "@/lib/chapters";
import { getClientIp, ipRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Everything the buddy is allowed to talk about: the story + the chapters.
function bookContext(): string {
  const preface = loadPreface() || "";
  const chapters = loadChapters();
  const chapterText = chapters
    .map((c) => {
      const buys = c.buys.map((b) => `bought ${b.shares} @ $${b.price} on ${b.date}`).join("; ");
      const sell = c.sell ? ` Sold @ $${c.sell.price} on ${c.sell.date}.` : "";
      return `Chapter ${c.chapter}: ${c.company || c.ticker} (${c.ticker}) — "${c.title}". Status: ${c.status}. ${buys}.${sell} Exit plan: ${c.exitTest}.\n${c.body}`;
    })
    .join("\n\n");
  return `THE STORY (why Krupesh writes this book):\n${preface}\n\nTHE CHAPTERS:\n${
    chapterText || "No chapters yet — Krupesh's first buy hasn't happened."
  }`;
}

function system(ctx: string): string {
  return `You are Krupesh's AI assistant on his website "Buy Right Sit Tight", a public book where Krupesh — who started this book at 15 — journals the stocks he buys with his own money, to learn investing. You help visitors and speak about Krupesh in the third person (he/his), never as if you are him.

Rules:
- Warm and brief. 2–4 sentences.
- Answer ONLY using the material below. If a question is off-topic (not about Krupesh, this book, or its chapters), gently say you can only chat about Krupesh's book and the stocks in it.
- Never give investment advice, opinions on whether to buy or sell, or predictions. If asked, say this is a learning journal, not advice.
- Never invent chapters, prices, dates, or facts that aren't in the material.

MATERIAL:
${ctx}`;
}

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  if (process.env.PUBLIC_ASK_ENABLED !== "1") {
    return NextResponse.json(
      { ok: false, error: "The buddy's Q&A isn't switched on right now — but I can still tell you the story!" },
      { status: 503 }
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: "Q&A isn't configured yet." }, { status: 503 });
  }

  // Per-IP ceiling (survives cookie-clearing), generous for shared IPs.
  if (!ipRateLimit(`ask:${getClientIp(req)}`, 60, 3_600_000)) {
    return NextResponse.json(
      { ok: false, error: "That's a lot of questions! Give the buddy a short break." },
      { status: 429 }
    );
  }

  // Soft per-browser rate limit (cheap deterrent; the real cost guards are the
  // on/off switch, the small model, and short answers).
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/brst_ask=(\d+)\.(\d+)/);
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
  const LIMIT = 20;
  if (n >= LIMIT) {
    return NextResponse.json(
      { ok: false, error: "That's a lot of questions! Give the buddy a short break and come back soon." },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { question?: string; history?: Msg[] };
  const question = String(body.question || "").slice(0, 500).trim();
  if (!question) return NextResponse.json({ ok: false, error: "Ask a question first." }, { status: 400 });

  const history: Msg[] = Array.isArray(body.history)
    ? body.history.filter((x) => x && (x.role === "user" || x.role === "assistant") && typeof x.content === "string").slice(-6)
    : [];

  try {
    const client = new Anthropic();
    const model = process.env.PUBLIC_ASK_MODEL || "claude-haiku-4-5";
    const response = await client.messages.create({
      model,
      max_tokens: 400,
      system: system(bookContext()),
      messages: [...history, { role: "user", content: question }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const res = NextResponse.json({ ok: true, text });
    res.cookies.set("brst_ask", `${n + 1}.${resetAt}`, { path: "/", maxAge: 3600, sameSite: "lax" });
    return res;
  } catch (e) {
    const detail = e instanceof Error ? e.message : "The buddy had trouble answering.";
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }
}
