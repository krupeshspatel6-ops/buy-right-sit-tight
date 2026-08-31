// Best-effort per-IP rate limiting for the public AI endpoints, on top of the
// per-browser cookie limit. Cookies are trivially cleared, so this adds an IP
// ceiling that a single spammer can't dodge by wiping cookies.
//
// NOTE: this is in-memory, so it only holds within a warm serverless instance
// and resets on cold starts — it raises the bar against naive abuse but is not
// a defense against a distributed attack. For that, front these routes with a
// durable limiter (Upstash Redis / Vercel WAF). Limits here are set generously
// so shared IPs (offices, mobile carriers) aren't falsely blocked.

const buckets = new Map<string, number[]>();

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0].trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

// Returns true if allowed, false if over the limit in the window.
export function ipRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  // Occasionally prune stale keys so the map can't grow without bound.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
    }
  }
  return true;
}
