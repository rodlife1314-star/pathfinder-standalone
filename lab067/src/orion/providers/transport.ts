/**
 * Provider-agnostic HTTPS transport: one POST, hard timeout, no retries,
 * deterministic error taxonomy, credential redaction on every message.
 * Never returns request headers.
 */
import type { HttpRequestSpec, ParsedCompletion, ProviderDefinition } from "./types.ts";
import { redact, truncate } from "../model/redact.ts";

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  ok: boolean; status: number; statusText: string; headers: { get(name: string): string | null }; text(): Promise<string>;
}>;

export type ModelErrorKind =
  | "timeout" | "network" | "http" | "rate-limited" | "auth"
  | "invalid-response" | "empty-response" | "incomplete" | "refusal";

export type CallResult =
  | { ok: true; completion: ParsedCompletion; providerRequestId: string | null; httpStatus: number; latencyMs: number }
  | { ok: false; kind: ModelErrorKind; message: string; httpStatus: number | null; latencyMs: number };

export async function sendRequest(
  provider: ProviderDefinition,
  spec: HttpRequestSpec,
  opts: { timeoutMs: number; secrets: readonly string[]; fetchImpl?: FetchLike; now?: () => number },
): Promise<CallResult> {
  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const now = opts.now ?? (() => performance.now());
  const t0 = now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  const fail = (kind: ModelErrorKind, message: string, httpStatus: number | null = null): CallResult => ({
    ok: false, kind, message: truncate(redact(message, opts.secrets)), httpStatus, latencyMs: now() - t0,
  });
  try {
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await fetchImpl(spec.url, { method: "POST", headers: spec.headers, body: JSON.stringify(spec.body), signal: ctrl.signal });
    } catch (e) {
      if (ctrl.signal.aborted) return fail("timeout", `No response within ${opts.timeoutMs} ms`);
      return fail("network", `Request failed: ${(e as Error)?.message ?? String(e)}`);
    }
    let bodyText: string;
    try { bodyText = await res.text(); } catch (e) {
      if (ctrl.signal.aborted) return fail("timeout", `Response body not received within ${opts.timeoutMs} ms`, res.status);
      return fail("network", `Reading response failed: ${(e as Error)?.message ?? String(e)}`, res.status);
    }
    if (!res.ok) {
      const kind: ModelErrorKind = res.status === 401 || res.status === 403 ? "auth" : res.status === 429 ? "rate-limited" : "http";
      return fail(kind, `HTTP ${res.status} ${res.statusText}: ${bodyText}`, res.status);
    }
    let json: unknown;
    try { json = JSON.parse(bodyText); } catch { return fail("invalid-response", `Response is not JSON: ${bodyText}`, res.status); }
    const parsed = provider.parseResponse(json);
    if (!parsed.ok) return fail(parsed.kind, parsed.message, res.status);
    const reqId = provider.requestIdHeaders.map((h) => res.headers.get(h)).find((v) => !!v) ?? null;
    return { ok: true, completion: parsed.completion, providerRequestId: reqId, httpStatus: res.status, latencyMs: now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}
