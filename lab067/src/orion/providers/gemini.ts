/**
 * Google Gemini generateContent (POST {base}/v1beta/models/{model}:generateContent). Raw HTTPS.
 * Shape source: official-domain search excerpts, 2026-11-03. RISKS recorded: Google labels this
 * endpoint "Generate Content API (Legacy)"; docs disagree on responseJsonSchema vs responseSchema
 * and on thinkingLevel casing. ai.google.dev could not be fetched from the build session.
 * LIVE: NOT TESTED.
 */
import type { ParseOutcome, ProviderDefinition } from "./types.ts";

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);

export const geminiProvider: ProviderDefinition = {
  id: "gemini",
  displayName: "Google Gemini (generateContent)",
  defaultBaseUrl: "https://generativelanguage.googleapis.com",
  enforcesSchema: true,
  effortValues: ["minimal", "low", "medium", "high"],
  requestIdHeaders: ["x-goog-request-id"],
  shapeSource: "Official-domain search excerpts (2026-11-03); endpoint labelled Legacy by Google; schema field name ambiguous in docs; unverified against a live call.",
  buildRequest(base, model, apiKey, req) {
    return {
      url: `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: req.responseSchema,
          maxOutputTokens: req.maxOutputTokens,
          ...(req.effort ? { thinkingConfig: { thinkingLevel: req.effort.toUpperCase() } } : {}),
        },
      },
    };
  },
  parseResponse(json): ParseOutcome {
    const b = json as { responseId?: unknown; modelVersion?: unknown; promptFeedback?: { blockReason?: unknown }; candidates?: unknown; usageMetadata?: Record<string, unknown> };
    if (!b || typeof b !== "object") return { ok: false, kind: "invalid-response", message: "Body is not an object" };
    if (b.promptFeedback?.blockReason) return { ok: false, kind: "refusal", message: `Prompt blocked: ${String(b.promptFeedback.blockReason)}` };
    const cand = Array.isArray(b.candidates) ? (b.candidates[0] as { finishReason?: unknown; content?: { parts?: unknown } } | undefined) : undefined;
    if (!cand) return { ok: false, kind: "invalid-response", message: "No candidates" };
    if (cand.finishReason === "SAFETY" || cand.finishReason === "PROHIBITED_CONTENT") return { ok: false, kind: "refusal", message: `Blocked: ${String(cand.finishReason)}` };
    if (cand.finishReason === "MAX_TOKENS") return { ok: false, kind: "incomplete", message: "Output truncated at maxOutputTokens (thinking tokens count toward it)" };
    const parts = Array.isArray(cand.content?.parts) ? (cand.content!.parts as { text?: unknown; thought?: unknown }[]) : [];
    const text = parts.filter((p) => p?.thought !== true && typeof p?.text === "string").map((p) => p.text as string).join("");
    if (!text.trim()) return { ok: false, kind: "empty-response", message: "No non-thought text parts" };
    return {
      ok: true,
      completion: {
        text,
        reportedModel: typeof b.modelVersion === "string" ? b.modelVersion : null,
        responseId: typeof b.responseId === "string" ? b.responseId : null,
        stop: cand.finishReason === "STOP" ? "complete" : `other:${String(cand.finishReason)}`,
        usage: { inputTokens: num(b.usageMetadata?.promptTokenCount), outputTokens: num(b.usageMetadata?.candidatesTokenCount), reasoningTokens: num(b.usageMetadata?.thoughtsTokenCount) },
      },
    };
  },
};
