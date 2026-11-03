/**
 * Minimal client for an OpenAI-compatible /chat/completions endpoint using the
 * platform `fetch` (no SDK dependency). Deterministic error taxonomy, hard
 * timeout via AbortController, no retries (a failed call is reported, not hidden).
 * Never includes request headers or the key in any returned value.
 */
import type { OrionModelConfig } from "./config.ts";
import { redact, truncate } from "./redact.ts";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  ok: boolean; status: number; statusText: string; headers: { get(name: string): string | null }; text(): Promise<string>;
}>;

export type ModelErrorKind = "timeout" | "network" | "http" | "rate-limited" | "auth" | "invalid-response" | "empty-response";

export interface ModelCallSuccess {
  ok: true;
  content: string;
  requestedModel: string;
  /** Model id as reported by the provider in the response body (may differ from requested). */
  reportedModel: string | null;
  responseId: string | null;
  /** Provider request id from response headers, if any. */
  providerRequestId: string | null;
  finishReason: string | null;
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null };
  latencyMs: number;
  httpStatus: number;
}

export interface ModelCallFailure {
  ok: false;
  kind: ModelErrorKind;
  message: string;
  httpStatus: number | null;
  requestedModel: string;
  latencyMs: number;
}

export type ModelCallResult = ModelCallSuccess | ModelCallFailure;

const numOrNull = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const strOrNull = (x: unknown): string | null => (typeof x === "string" && x.length > 0 ? x : null);

export async function callChatCompletion(
  config: OrionModelConfig,
  messages: readonly ChatMessage[],
  deps: { fetchImpl?: FetchLike; now?: () => number } = {},
): Promise<ModelCallResult> {
  const fetchImpl = deps.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const now = deps.now ?? (() => performance.now());
  const t0 = now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.timeoutMs);
  const fail = (kind: ModelErrorKind, message: string, httpStatus: number | null = null): ModelCallFailure => ({
    ok: false, kind, message: truncate(redact(message, [config.apiKey])), httpStatus, requestedModel: config.model, latencyMs: now() - t0,
  });

  try {
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model, messages, temperature: config.temperature, top_p: 1, max_tokens: config.maxTokens, stream: false,
        }),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (ctrl.signal.aborted) return fail("timeout", `No response within ${config.timeoutMs} ms`);
      return fail("network", `Request failed: ${(e as Error)?.message ?? String(e)}`);
    }

    let bodyText: string;
    try {
      bodyText = await res.text();
    } catch (e) {
      if (ctrl.signal.aborted) return fail("timeout", `Response body not received within ${config.timeoutMs} ms`, res.status);
      return fail("network", `Reading response failed: ${(e as Error)?.message ?? String(e)}`, res.status);
    }

    if (!res.ok) {
      const kind: ModelErrorKind = res.status === 401 || res.status === 403 ? "auth" : res.status === 429 ? "rate-limited" : "http";
      return fail(kind, `HTTP ${res.status} ${res.statusText}: ${bodyText}`, res.status);
    }

    let body: unknown;
    try { body = JSON.parse(bodyText); } catch { return fail("invalid-response", `Response is not JSON: ${bodyText}`, res.status); }
    const b = body as { id?: unknown; model?: unknown; choices?: { message?: { content?: unknown }; finish_reason?: unknown }[]; usage?: Record<string, unknown> };
    const choice = Array.isArray(b.choices) ? b.choices[0] : undefined;
    if (!choice || typeof choice !== "object") return fail("invalid-response", "Response has no choices[0]", res.status);
    const content = choice.message?.content;
    if (typeof content !== "string") return fail("invalid-response", "choices[0].message.content is not a string", res.status);
    if (content.trim() === "") return fail("empty-response", "Model returned empty content", res.status);

    return {
      ok: true,
      content,
      requestedModel: config.model,
      reportedModel: strOrNull(b.model),
      responseId: strOrNull(b.id),
      providerRequestId: res.headers.get("x-request-id") ?? res.headers.get("nvcf-reqid"),
      finishReason: strOrNull(choice.finish_reason),
      usage: { promptTokens: numOrNull(b.usage?.prompt_tokens), completionTokens: numOrNull(b.usage?.completion_tokens), totalTokens: numOrNull(b.usage?.total_tokens) },
      latencyMs: now() - t0,
      httpStatus: res.status,
    };
  } finally {
    clearTimeout(timer);
  }
}
