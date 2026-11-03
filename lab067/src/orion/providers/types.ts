/**
 * Provider-independent contract between ORION and any reasoning-model vendor.
 *
 * ORION (prompt, schema, admission, contract guard, trace) depends ONLY on this
 * file. A provider module translates a ReasoningRequest into one HTTPS request
 * and the provider's JSON back into a ParsedCompletion. Providers get no access
 * to the ledger, the Crucible, the physics engines or any other module.
 */
export type ProviderId = "anthropic" | "openai" | "gemini" | "openai-compatible";

export interface ReasoningRequest {
  system: string;
  user: string;
  /** JSON Schema the provider should enforce (if it supports structured output). */
  responseSchema: Record<string, unknown>;
  schemaName: string;
  maxOutputTokens: number;
  /** Provider-specific reasoning depth (e.g. "high"); undefined = provider default. */
  effort?: string;
}

export interface HttpRequestSpec {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export interface ParsedCompletion {
  text: string;
  reportedModel: string | null;
  responseId: string | null;
  /** Normalised stop reason: "complete" | "max_tokens" | "refusal" | "other:<raw>". */
  stop: string;
  usage: { inputTokens: number | null; outputTokens: number | null; reasoningTokens: number | null };
}

export type ParseOutcome = { ok: true; completion: ParsedCompletion } | { ok: false; kind: "refusal" | "invalid-response" | "empty-response" | "incomplete"; message: string };

export interface ProviderDefinition {
  id: ProviderId;
  displayName: string;
  defaultBaseUrl: string | null;
  /** Whether the provider enforces responseSchema server-side (vs. prompt-only JSON). */
  enforcesSchema: boolean;
  /** Accepted effort values (validated in config). Empty = effort not supported. */
  effortValues: readonly string[];
  buildRequest(base: string, model: string, apiKey: string, req: ReasoningRequest): HttpRequestSpec;
  parseResponse(json: unknown): ParseOutcome;
  /** Header that carries a provider request id, if any. */
  requestIdHeaders: readonly string[];
  /** Integration confidence for the request/response shape, recorded in docs and traces. */
  shapeSource: string;
}
