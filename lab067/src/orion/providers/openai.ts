/**
 * OpenAI Responses API (POST {base}/responses). Raw HTTPS, no SDK.
 * Shape source: official-domain search excerpts, 2026-11-03 (text.format json_schema + strict;
 * reasoning.effort; GPT-6 Astra / GPT-6.1 Sol reject "none"). developers.openai.com could not be
 * fetched from the build session. LIVE: NOT TESTED.
 */
import type { ParseOutcome, ProviderDefinition } from "./types.ts";

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);

export const openaiProvider: ProviderDefinition = {
  id: "openai",
  displayName: "OpenAI (Responses API)",
  defaultBaseUrl: "https://api.openai.com/v1",
  enforcesSchema: true,
  effortValues: ["none", "minimal", "low", "medium", "high", "xhigh"],
  requestIdHeaders: ["x-request-id"],
  shapeSource: "Official-domain search excerpts (2026-11-03); documentation pages unreachable from the build session; unverified against a live call.",
  buildRequest(base, model, apiKey, req) {
    return {
      url: `${base}/responses`,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: {
        model,
        instructions: req.system,
        input: req.user,
        max_output_tokens: req.maxOutputTokens,
        store: false,
        ...(req.effort ? { reasoning: { effort: req.effort } } : {}),
        text: { format: { type: "json_schema", name: req.schemaName, schema: req.responseSchema, strict: true } },
      },
    };
  },
  parseResponse(json): ParseOutcome {
    const b = json as { id?: unknown; model?: unknown; status?: unknown; incomplete_details?: { reason?: unknown } | null; output?: unknown; usage?: { input_tokens?: unknown; output_tokens?: unknown; output_tokens_details?: { reasoning_tokens?: unknown } } };
    if (!b || typeof b !== "object" || !Array.isArray(b.output)) return { ok: false, kind: "invalid-response", message: "No output array" };
    if (b.status === "incomplete") return { ok: false, kind: "incomplete", message: `Response incomplete: ${String(b.incomplete_details?.reason ?? "unknown")}` };
    let text = "";
    for (const item of b.output as { type?: unknown; content?: unknown }[]) {
      if (item?.type !== "message" || !Array.isArray(item.content)) continue;
      for (const c of item.content as { type?: unknown; text?: unknown; refusal?: unknown }[]) {
        if (c?.type === "refusal") return { ok: false, kind: "refusal", message: `Model refused: ${String(c.refusal ?? "").slice(0, 200)}` };
        if (c?.type === "output_text" && typeof c.text === "string") text += c.text;
      }
    }
    if (!text.trim()) return { ok: false, kind: "empty-response", message: "No output_text content" };
    return {
      ok: true,
      completion: {
        text,
        reportedModel: typeof b.model === "string" ? b.model : null,
        responseId: typeof b.id === "string" ? b.id : null,
        stop: b.status === "completed" ? "complete" : `other:${String(b.status)}`,
        usage: { inputTokens: num(b.usage?.input_tokens), outputTokens: num(b.usage?.output_tokens), reasoningTokens: num(b.usage?.output_tokens_details?.reasoning_tokens) },
      },
    };
  },
};
