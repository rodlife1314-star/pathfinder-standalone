/**
 * ORION model service: config → provider request → transport → admission → traced response.
 * Provider-independent: swapping vendor changes only `config.provider`.
 * The returned object is data. It grants no ledger write (the UI records proposals only
 * through the contract guard), no Crucible authority and no tool or hardware access.
 */
import type { OrionQueryKind } from "../console.ts";
import { sha256Hex } from "../../ledger/sha256.ts";
import { PROVIDERS } from "../providers/registry.ts";
import { sendRequest, type FetchLike, type ModelErrorKind } from "../providers/transport.ts";
import type { OrionModelConfig } from "./config.ts";
import { admitModelOutput, type AdmittedSections } from "./admission.ts";
import { buildUserMessage, ORION_SYSTEM_PROMPT, PROMPT_VERSION } from "./prompt.ts";
import { ORION_RESPONSE_SCHEMA, ORION_SCHEMA_NAME, ORION_SCHEMA_VERSION } from "./schema.ts";

export const ORION_MODEL_RESPONSE_SCHEMA = "lab067.orion-model-response/0.2.0" as const;
export const MAX_QUERY_CHARS = 2000;

export interface TraceStep { at: string; step: string }

export interface OrionModelResponse {
  schema: typeof ORION_MODEL_RESPONSE_SCHEMA;
  query: { kind: OrionQueryKind; text: string };
  outcome: "ANSWERED" | "REJECTED" | "ERROR";
  provider: { id: string; host: string; requestedModel: string; reportedModel: string | null; effort: string | null; schemaEnforced: boolean };
  promptVersion: string;
  responseSchemaVersion: string;
  /** SHA-256 of the exact system + user text sent, so evaluation inputs are reproducible. */
  inputSha256: string;
  call: {
    latencyMs: number; httpStatus: number | null; responseId: string | null; providerRequestId: string | null; stop: string | null;
    usage: { inputTokens: number | null; outputTokens: number | null; reasoningTokens: number | null } | null;
  };
  error: { kind: ModelErrorKind; message: string } | null;
  admitted: AdmittedSections | null;
  rawContentSha256: string | null;
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
  const def = PROVIDERS[config.provider];
  const host = new URL(config.baseUrl).host;
  const user = buildUserMessage(query.kind, query.text);
  const spec = def.buildRequest(config.baseUrl, config.model, config.apiKey, {
    system: ORION_SYSTEM_PROMPT, user, responseSchema: ORION_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    schemaName: ORION_SCHEMA_NAME, maxOutputTokens: config.maxOutputTokens, effort: config.effort,
  });
  const provider = { id: def.id, host, requestedModel: config.model, reportedModel: null as string | null, effort: config.effort ?? null, schemaEnforced: def.enforcesSchema };
  const verification = { status: "UNVERIFIED" as const, evaluatedByCrucible: false as const, calculationsPerformedByOrion: false as const };
  const base = { schema: ORION_MODEL_RESPONSE_SCHEMA, query, promptVersion: PROMPT_VERSION, responseSchemaVersion: ORION_SCHEMA_VERSION, inputSha256: sha256Hex(`${ORION_SYSTEM_PROMPT}\n\u0000\n${user}`), trace, verification };

  t(`Prompt ${PROMPT_VERSION}, schema ${ORION_SCHEMA_VERSION} (${def.enforcesSchema ? "enforced by provider" : "requested in prompt only"}), request kind "${query.kind}".`);
  t(`Provider ${def.displayName}: POST https://${host}/…, model "${config.model}"${config.effort ? `, effort "${config.effort}"` : ""}, timeout ${config.timeoutMs} ms, max ${config.maxOutputTokens} output tokens, no retries.`);
  const r = await sendRequest(def, spec, { timeoutMs: config.timeoutMs, secrets: [config.apiKey], fetchImpl: deps.fetchImpl, now: deps.now });

  if (!r.ok) {
    t(`Call failed: ${r.kind}${r.httpStatus ? ` (HTTP ${r.httpStatus})` : ""} after ${Math.round(r.latencyMs)} ms.`);
    return {
      ...base, outcome: "ERROR", provider,
      call: { latencyMs: r.latencyMs, httpStatus: r.httpStatus, responseId: null, providerRequestId: null, stop: null, usage: null },
      error: { kind: r.kind, message: r.message }, admitted: null, rawContentSha256: null, quarantinedRawText: null,
    };
  }

  const c = r.completion;
  provider.reportedModel = c.reportedModel;
  t(`HTTP ${r.httpStatus} in ${Math.round(r.latencyMs)} ms. Provider reports model "${c.reportedModel ?? "(not reported)"}"; stop "${c.stop}".`);
  if (c.reportedModel && !c.reportedModel.startsWith(config.model)) t(`WARNING: reported model differs from requested model "${config.model}".`);
  const admitted = admitModelOutput(query.kind, c.text);
  t(`Contract admission: ${admitted.disposition}${admitted.rejectionReason ? ` — ${admitted.rejectionReason}` : ""}.`);
  if (admitted.schemaDeviations.length) t(`Schema deviations: ${admitted.schemaDeviations.join("; ")}.`);
  if (admitted.numericalClaims.length || admitted.answerValues.length) t(`${admitted.answerValues.length} answer value(s) and ${admitted.numericalClaims.length} numerical statement(s) from the model — NOT computed by the deterministic engine.`);
  if (admitted.validationLanguage.length) t(`Validation/feasibility language detected: ${admitted.validationLanguage.join(", ")} — not supported by any Crucible result.`);
  if (admitted.citationLike.length) t(`${admitted.citationLike.length} URL/DOI-like string(s) — unverified; may be fabricated.`);
  t("Response is UNVERIFIED. It has not been evaluated by the Crucible.");

  return {
    ...base, outcome: admitted.disposition === "REJECTED" ? "REJECTED" : "ANSWERED", provider,
    call: { latencyMs: r.latencyMs, httpStatus: r.httpStatus, responseId: c.responseId, providerRequestId: r.providerRequestId, stop: c.stop, usage: c.usage },
    error: null, admitted, rawContentSha256: sha256Hex(c.text),
    quarantinedRawText: admitted.disposition === "ADMITTED" ? null : c.text.slice(0, 8000),
  };
}
