/**
 * Request guards for /api/orion (protecting the API key's quota).
 *
 *  - Fixed-window rate limit per client, in process memory. Resets on server
 *    restart and is per-instance — adequate for a single dev server, NOT for a
 *    multi-instance deployment.
 *  - Same-origin check: a browser POST from another origin is refused.
 *    Requests with no Origin header (curl, server-to-server) are allowed;
 *    this is CSRF protection, not authentication.
 */
export interface RateLimiter {
  check(clientId: string): { allowed: boolean; remaining: number; retryAfterMs: number };
}

export function createRateLimiter(limit: number, windowMs: number, now: () => number = () => Date.now()): RateLimiter {
  const hits = new Map<string, { start: number; count: number }>();
  return {
    check(clientId) {
      const t = now();
      // Opportunistic cleanup keeps memory bounded.
      if (hits.size > 1000) for (const [k, v] of hits) if (t - v.start >= windowMs) hits.delete(k);
      const w = hits.get(clientId);
      if (!w || t - w.start >= windowMs) {
        hits.set(clientId, { start: t, count: 1 });
        return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
      }
      if (w.count >= limit) return { allowed: false, remaining: 0, retryAfterMs: windowMs - (t - w.start) };
      w.count++;
      return { allowed: true, remaining: limit - w.count, retryAfterMs: 0 };
    },
  };
}

/** Client identity for rate limiting. Proxy headers are spoofable; documented limitation. */
export function clientId(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || headers.get("x-real-ip") || "local";
}

export function sameOriginViolation(headers: Headers, requestUrl: string): string | null {
  const origin = headers.get("origin");
  if (!origin) return null;
  let o: URL;
  try { o = new URL(origin); } catch { return "Malformed Origin header"; }
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? new URL(requestUrl).host;
  return o.host === host ? null : `Cross-origin request from ${o.host} refused`;
}

export function readRateLimit(env: Record<string, string | undefined>): number {
  const n = Number(env.ORION_RATE_LIMIT_PER_MIN ?? "10");
  return Number.isInteger(n) && n >= 1 && n <= 600 ? n : 10;
}
