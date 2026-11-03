/**
 * Generic OpenAI-compatible /chat/completions endpoint (any vendor or self-hosted server).
 * No schema enforcement is assumed: the JSON shape is requested in the prompt and checked
 * by ORION's admission. Requires an explicit ORION_BASE_URL — there is no default host.
 */
import type { ParseOutcome, ProviderDefinition } from "./types.ts";

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);

export const openaiCompatibleProvider: ProviderDefinition = {
  id: "openai-compatible",
  displayName: "OpenAI-compatible chat completions (generic)",
  defaultBaseUrl: null,
  enforcesSchema: false,
  effortValues: [],
  requestIdHeaders: ["x-request-id"],
  shapeSource: "De-facto OpenAI chat-completions shape; vendor-specific behaviour unknown.",
  buildRequest(base, model, apiKey, req) {
    return {
      url: `${base}/chat/completions`,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: {
        model,
        max_tokens: req.maxOutputTokens,
        stream: false,
        messages: [
          { role: "system", content: `${req.system}\n\nRespond with ONLY a JSON object matching this JSON Schema, no prose outside it:\n${JSON.stringify(req.responseSchema)}` },
          { role: "user", content: req.user },
        ],
      },
    };
  },
  parseResponse(json): ParseOutcome {
    const b = json as { id?: unknown; model?: unknown; choices?: { message?: { content?: unknown; refusal?: unknown }; finish_reason?: unknown }[]; usage?: Record<string, unknown> };
    const choice = Array.isArray(b?.choices) ? b.choices[0] : undefined;
    if (!choice || typeof choice !== "object") return { ok: false, kind: "invalid-response", message: "Response has no choices[0]" };
    if (typeof choice.message?.refusal === "string" && choice.message.refusal) return { ok: false, kind: "refusal", message: `Model refused: ${choice.message.refusal.slice(0, 200)}` };
    const content = choice.message?.content;
    if (typeof content !== "string") return { ok: false, kind: "invalid-response", message: "choices[0].message.content is not a string" };
    if (choice.finish_reason === "length") return { ok: false, kind: "incomplete", message: "Output truncated at max_tokens" };
    if (!content.trim()) return { ok: false, kind: "empty-response", message: "Model returned empty content" };
    return {
      ok: true,
      completion: {
        text: content,
        reportedModel: typeof b.model === "string" ? b.model : null,
        responseId: typeof b.id === "string" ? b.id : null,
        stop: choice.finish_reason === "stop" ? "complete" : `other:${String(choice.finish_reason)}`,
        usage: { inputTokens: num(b.usage?.prompt_tokens), outputTokens: num(b.usage?.completion_tokens), reasoningTokens: null },
      },
    };
  },
};
