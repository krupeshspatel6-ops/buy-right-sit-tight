import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The AI is a WRITING COACH, not an analyst. It helps Krupesh express his own
// thinking — it must never invent the investment thesis, add facts/figures he
// didn't write, give advice, or hype. This keeps the book authentically his,
// and keeps it "not advice."
const SYSTEM = `You are a patient writing coach for Krupesh, a 15-year-old who writes a public journal about stocks he buys with his own saved money. Your ONLY job is to help him express HIS OWN thinking more clearly and honestly.

Hard rules, never broken:
- Never invent reasons, facts, numbers, financial figures, or an investment thesis he did not write. If his draft is thin or vague, surface that as a gentle question — do not fill it in for him.
- Never give investment advice, opinions on whether a stock is good, price targets, or predictions.
- Keep his voice: a curious, honest teenager who is learning — never corporate, never analyst-speak, never hype.
- You are an editor and a Socratic coach. You tighten and clarify what he wrote, and you ask questions. You do not write the substance for him.`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "AI isn't configured yet — set ANTHROPIC_API_KEY." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    mode?: string;
    ticker?: string;
    company?: string;
    draft?: string;
  };
  const ticker = String(body.ticker || "").toUpperCase();
  const company = String(body.company || "").trim();
  const who = company ? `${company} (${ticker})` : ticker || "this stock";
  const draft = String(body.draft || "").trim();

  const userMsg =
    body.mode === "questions"
      ? `I'm about to write why I bought ${who}. Give me 4–5 short, specific questions to help me think it through and write honestly — about what the business does, why I believe in it for the long term, why the price I paid is fair, and what could go wrong. Only the questions, as a simple list. Do not answer them for me.`
      : `Lightly edit my draft below for clarity and flow. Keep my voice and my own ideas. Do NOT add any new facts, numbers, or reasons I didn't write — if something is vague, you may tighten the wording but not invent content. Return only the improved draft, nothing else.\n\nStock: ${who}\n\nMy draft:\n"""\n${draft || "(empty)"}\n"""`;

  try {
    const client = new Anthropic();
    const model = process.env.AI_MODEL || "claude-opus-5";
    const response = await client.messages.create({
      model,
      max_tokens: 4000,
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "AI request failed.";
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }
}
