/**
 * Server-only ORION model route. The API key is read here from process.env and
 * is never returned, logged, or sent anywhere except the configured endpoint.
 */
import { readOrionConfig, publicDescriptor } from "../../../src/orion/model/config.ts";
import { askOrionModel, MAX_QUERY_CHARS } from "../../../src/orion/model/service.ts";
import type { OrionQueryKind } from "../../../src/orion/console.ts";
import { clientId, createRateLimiter, readRateLimit, sameOriginViolation } from "../../../src/orion/model/guard.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: readonly OrionQueryKind[] = ["scientific-question", "explain-equation", "list-assumptions", "propose-experiment"];
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

// One limiter per server process (see guard.ts for limits of this approach).
const limiter = createRateLimiter(readRateLimit(process.env), 60_000);

export function GET() {
  const c = readOrionConfig(process.env);
  return json(c.ok ? publicDescriptor(c.config) : { ...c.descriptor, reason: c.error });
}

export async function POST(req: Request) {
  const cross = sameOriginViolation(req.headers, req.url);
  if (cross) return json({ outcome: "ERROR", error: { kind: "forbidden", message: cross } }, 403);
  const c = readOrionConfig(process.env);
  if (!c.ok) return json({ outcome: "ERROR", error: { kind: "config", message: c.error }, provider: c.descriptor }, 503);
  let body: unknown;
  try { body = await req.json(); } catch { return json({ outcome: "ERROR", error: { kind: "bad-request", message: "Body must be JSON" } }, 400); }
  const b = body as { kind?: unknown; text?: unknown };
  if (typeof b.kind !== "string" || !KINDS.includes(b.kind as OrionQueryKind)) return json({ outcome: "ERROR", error: { kind: "bad-request", message: "Unknown request kind" } }, 400);
  if (typeof b.text !== "string" || !b.text.trim()) return json({ outcome: "ERROR", error: { kind: "bad-request", message: "Question text required" } }, 400);
  if (b.text.length > MAX_QUERY_CHARS) return json({ outcome: "ERROR", error: { kind: "bad-request", message: `Question exceeds ${MAX_QUERY_CHARS} characters` } }, 400);

  const rl = limiter.check(clientId(req.headers));
  if (!rl.allowed) {
    const secs = Math.ceil(rl.retryAfterMs / 1000);
    return Response.json({ outcome: "ERROR", error: { kind: "rate-limited-local", message: `ORION request limit reached; retry in ${secs} s` } },
      { status: 429, headers: { "retry-after": String(secs), "cache-control": "no-store" } });
  }

  const resp = await askOrionModel(c.config, { kind: b.kind as OrionQueryKind, text: b.text.trim() });
  if (resp.outcome === "ERROR") {
    // Server log: kind + status only. No headers, no key, no request body.
    console.warn(`[orion] model call failed: ${resp.error?.kind} status=${resp.call.httpStatus ?? "-"} latencyMs=${Math.round(resp.call.latencyMs)}`);
  }
  return json(resp, resp.outcome === "ERROR" ? 502 : 200);
}
