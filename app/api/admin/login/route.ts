import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSession, adminConfigured, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Admin isn't configured yet. Set ADMIN_USER, ADMIN_PASSWORD, and SESSION_SECRET.",
      },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const okUser = safeEqual(email, (process.env.ADMIN_USER || "").toLowerCase());
  const okPass = safeEqual(password, process.env.ADMIN_PASSWORD || "");

  if (!okUser || !okPass) {
    await new Promise((r) => setTimeout(r, 500)); // slow brute force a little
    return NextResponse.json({ ok: false, error: "Wrong email or password." }, { status: 401 });
  }

  const token = await createSession(email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
