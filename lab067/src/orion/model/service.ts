/**
 * ORION model service: config → prompt → HTTP call → admission → traced response.
 * Pure orchestration; injectable fetch and clock for tests. Server-side only by
 * convention (it is given the config; it never reads process.env itself).
 */
import type { OrionQueryKind } from "../console.ts";
import { sha256Hex } from "../../ledger/sha256.ts";
import { callChatCompletion, type FetchLike, type ModelErrorKind } from "./client.ts";
import type { OrionModelConfig } from "./config.ts";
import { admitModelOutput, type AdmittedSections } from "./admission.ts";
import { buildMessages, PROMPT_VERSION } from "./prompt.ts";

export const ORION_MODEL_RESPONSE_SCHEMA = "lab067.orion-model-response/0.1.0" as const;
export const MAX_QUERY_CHARS = 2000;

export interface TraceStep { at: string; step: string }

export interface OrionModelResponse {
  schema: typeof ORION_MODEL_RESPONSE_SCHEMA;
  query: { kind: OrionQueryKind; text: string };
  outcome: "ANSWERED" | "REJECTED" | "ERROR";
  provider: { host: string; requestedModel: string; reportedModel: string | null };
  promptVersion: string;
  call: {
    latencyMs: number; httpStatus: number | null; responseId: string | null; providerRequestId: string | null;
    finishReason: string | null; usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } | null;
  };
  error: { kind: ModelErrorKind; message: string } | null;
  admitted: AdmittedSections | null;
  /** SHA-256 of the exact model text, so a recorded proposal can be tied to it. */
  rawContentSha256: string | null;
  /** Raw text is returned only for REJECTED or UNSTRUCTURED outputs, for Operator inspection. */
  quarantinedRawText: string | null;
  trace: TraceStep[];
  verification: { status: "UNVERIFIED"; evaluatedByCrucible: false; calculationsPerformedByOrion: false };
}

export async function askOrionModel(
  config: OrionModelConfig,
  query: { kind: OrionQueryKind; text: string },
  deps: { fetchImpl?: FetchLike; clock?: () => Date; now?: () => number } = {},
): Promise<OrionModelResponse> {
  const clock = deps.clock ?? (() => new Date());
  const trace: TraceStep[] = [];
  const t = (step: string) => trace.push({ at: clock().toISOString(), step });
  const host = new URL(config.baseUrl).host;

  t(`Prompt ${PROMPT_VERSION} built for request kind "${query.kind}" (${query.text.length} chars).`);
  t(`POST https://${host}/…/chat/completions, model "${config.model}", timeout ${config.timeoutMs} ms, no retries.`);
  const r = await callChatCompletion(config, buildMessages(query.kind, query.text), { fetchImpl: deps.fetchImpl, now: deps.now });
  const verification = { status: "UNVERIFIED" as const, evaluatedByCrucible: false as const, calculationsPerformedByOrion: false as const };

  if (!r.ok) {
    t(`Call failed: ${r.kind}${r.httpStatus ? ` (HTTP ${r.httpStatus})` : ""} after ${Math.round(r.latencyMs)} ms.`);
    return {
      schema: ORION_MODEL_RESPONSE_SCHEMA, query, outcome: "ERROR", promptVersion: PROMPT_VERSION,
      provider: { host, requestedModel: r.requestedModel, reportedModel: null },
      call: { latencyMs: r.latencyMs, httpStatus: r.httpStatus, responseId: null, providerRequestId: null, finishReason: null, usage: null },
      error: { kind: r.kind, message: r.message }, admitted: null, rawContentSha256: null, quarantinedRawText: null, trace, verification,
    };
  }

  t(`HTTP ${r.httpStatus} in ${Math.round(r.latencyMs)} ms. Provider reports model "${r.reportedModel ?? "(not reported)"}"; finish_reason "${r.finishReason ?? "?"}".`);
  if (r.reportedModel && r.reportedModel !== config.model) t(`WARNING: reported model differs from requested model "${config.model}".`);
  if (r.finishReason === "length") t("WARNING: output truncated at max_tokens.");
  const admitted = admitModelOutput(query.kind, r.content);
  t(`Contract admission: ${admitted.disposition}${admitted.rejectionReason ? ` — ${admitted.rejectionReason}` : ""}.`);
  if (admitted.numericalClaims.length) t(`${admitted.numericalClaims.length} numerical statement(s) flagged: produced by the language model, NOT computed by the deterministic engine.`);
  if (admitted.validationLanguage.length) t(`Validation/feasibility language detected: ${admitted.validationLanguage.join(", ")} — not supported by any Crucible result.`);
  t("Response is UNVERIFIED. It has not been evaluated by the Crucible.");

  return {
    schema: ORION_MODEL_RESPONSE_SCHEMA, query, outcome: admitted.disposition === "REJECTED" ? "REJECTED" : "ANSWERED",
    promptVersion: PROMPT_VERSION,
    provider: { host, requestedModel: r.requestedModel, reportedModel: r.reportedModel },
    call: { latencyMs: r.latencyMs, httpStatus: r.httpStatus, responseId: r.responseId, providerRequestId: r.providerRequestId, finishReason: r.finishReason, usage: r.usage },
    error: null, admitted, rawContentSha256: sha256Hex(r.content),
    quarantinedRawText: admitted.disposition === "ADMITTED" ? null : r.content.slice(0, 8000),
    trace, verification,
  };
}
