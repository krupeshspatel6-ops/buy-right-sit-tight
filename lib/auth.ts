import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "brst_session";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_SECRET || "");
}

// Admin is usable only once all three secrets are set (in Vercel env or a
// local .env). Missing any → the admin shows a "not configured" notice and
// every write route refuses. Safe by default.
export function adminConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_USER && process.env.ADMIN_PASSWORD && process.env.SESSION_SECRET
  );
}

export async function createSession(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<{ email: string } | null> {
  if (!process.env.SESSION_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return { email: String(payload.email ?? "") };
  } catch {
    return null;
  }
}
