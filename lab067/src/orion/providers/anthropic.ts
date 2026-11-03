/**
 * Anthropic Messages API (POST {base}/v1/messages), raw HTTPS per Operator directive (no SDK).
 * Shape source: bundled Claude API reference, cached 2026-10-06 (anthropic-version 2026-10-21;
 * output_config.format json_schema; output_config.effort; no temperature/top_p on this API version;
 * thinking omitted → adaptive on current models). LIVE: NOT TESTED.
 */
import type { ParseOutcome, ProviderDefinition } from "./types.ts";

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);

export const anthropicProvider: ProviderDefinition = {
  id: "anthropic",
  displayName: "Anthropic (Claude Messages API)",
  defaultBaseUrl: "https://api.anthropic.com",
  enforcesSchema: true,
  effortValues: ["low", "medium", "high", "xhigh", "max"],
  requestIdHeaders: ["request-id"],
  shapeSource: "Bundled Claude API reference (cached 2026-10-06); request shape verified against documentation, not against a live call.",
  buildRequest(base, model, apiKey, req) {
    return {
      url: `${base}/v1/messages`,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2026-10-21" },
      body: {
        model,
        max_tokens: req.maxOutputTokens,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        output_config: {
          format: { type: "json_schema", schema: req.responseSchema },
          ...(req.effort ? { effort: req.effort } : {}),
        },
      },
    };
  },
  parseResponse(json): ParseOutcome {
    const b = json as { id?: unknown; model?: unknown; stop_reason?: unknown; stop_details?: { category?: unknown; explanation?: unknown } | null; content?: unknown; usage?: Record<string, unknown> };
    if (!b || typeof b !== "object" || !Array.isArray(b.content)) return { ok: false, kind: "invalid-response", message: "No content array" };
    if (b.stop_reason === "refusal") {
      return { ok: false, kind: "refusal", message: `Model declined (category: ${String(b.stop_details?.category ?? "unspecified")})` };
    }
    const text = (b.content as { type?: unknown; text?: unknown }[]).filter((c) => c?.type === "text" && typeof c.text === "string").map((c) => c.text as string).join("");
    if (b.stop_reason === "max_tokens") return { ok: false, kind: "incomplete", message: "Output truncated at max_tokens; structured output may be incomplete" };
    if (!text.trim()) return { ok: false, kind: "empty-response", message: "No text content" };
    return {
      ok: true,
      completion: {
        text,
        reportedModel: typeof b.model === "string" ? b.model : null,
        responseId: typeof b.id === "string" ? b.id : null,
        stop: b.stop_reason === "end_turn" ? "complete" : `other:${String(b.stop_reason)}`,
        usage: { inputTokens: num(b.usage?.input_tokens), outputTokens: num(b.usage?.output_tokens), reasoningTokens: null },
      },
    };
  },
};
