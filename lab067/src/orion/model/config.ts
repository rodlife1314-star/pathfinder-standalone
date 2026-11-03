/**
 * ORION model configuration — provider-independent. Server environment only.
 *
 * There is deliberately NO default provider or model: the Human Operator must
 * choose both explicitly (ORION_PROVIDER, ORION_MODEL). The API key never
 * leaves the server; `publicDescriptor` is the only browser-safe view.
 */
import { PROVIDERS, isProviderId } from "../providers/registry.ts";
import type { ProviderId } from "../providers/types.ts";

export interface OrionModelConfig {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  maxOutputTokens: number;
  effort: string | undefined;
}

export interface PublicDescriptor {
  configured: boolean;
  provider: string;
  providerName: string;
  host: string;
  model: string;
  effort: string | null;
  timeoutMs: number;
  schemaEnforced: boolean;
}

export type ConfigResult = { ok: true; config: OrionModelConfig } | { ok: false; error: string; descriptor: PublicDescriptor };

export const LIMITS = { timeoutMs: [1_000, 600_000, 120_000], maxOutputTokens: [256, 64_000, 16_000] } as const;

function bounded(raw: string | undefined, [lo, hi, def]: readonly [number, number, number], name: string, errs: string[]): number {
  if (raw === undefined || raw.trim() === "") return def;
  const v = Number(raw);
  if (!Number.isInteger(v) || v < lo || v > hi) { errs.push(`${name} must be an integer in [${lo}, ${hi}]`); return def; }
  return v;
}

export function readOrionConfig(env: Record<string, string | undefined>): ConfigResult {
  const errs: string[] = [];
  const providerRaw = env.ORION_PROVIDER?.trim() ?? "";
  const providerOk = isProviderId(providerRaw);
  if (!providerRaw) errs.push("ORION_PROVIDER is not set (anthropic | openai | gemini | openai-compatible)");
  else if (!providerOk) errs.push(`ORION_PROVIDER "${providerRaw}" is not supported`);
  const def = providerOk ? PROVIDERS[providerRaw] : null;

  const model = env.ORION_MODEL?.trim() ?? "";
  if (!model) errs.push("ORION_MODEL is not set (the Operator must choose a model explicitly)");
  const apiKey = env.ORION_API_KEY?.trim() ?? "";
  if (!apiKey) errs.push("ORION_API_KEY is not set on the server");

  const baseUrl = (env.ORION_BASE_URL?.trim() || def?.defaultBaseUrl || "").replace(/\/+$/, "");
  let host = "—";
  if (!baseUrl) { if (def) errs.push(`ORION_BASE_URL is required for provider "${def.id}"`); }
  else {
    try { const u = new URL(baseUrl); host = u.host; if (u.protocol !== "https:") errs.push("ORION_BASE_URL must use https"); }
    catch { errs.push("ORION_BASE_URL is not a valid URL"); }
  }

  const effortRaw = env.ORION_EFFORT?.trim().toLowerCase() || undefined;
  if (effortRaw && def) {
    if (def.effortValues.length === 0) errs.push(`Provider "${def.id}" does not support ORION_EFFORT`);
    else if (!def.effortValues.includes(effortRaw)) errs.push(`ORION_EFFORT must be one of ${def.effortValues.join(", ")} for "${def.id}"`);
  }

  const timeoutMs = bounded(env.ORION_TIMEOUT_MS, LIMITS.timeoutMs, "ORION_TIMEOUT_MS", errs);
  const maxOutputTokens = bounded(env.ORION_MAX_OUTPUT_TOKENS, LIMITS.maxOutputTokens, "ORION_MAX_OUTPUT_TOKENS", errs);

  const descriptor: PublicDescriptor = {
    configured: errs.length === 0, provider: providerRaw || "—", providerName: def?.displayName ?? "—", host,
    model: model || "—", effort: effortRaw ?? null, timeoutMs, schemaEnforced: def?.enforcesSchema ?? false,
  };
  if (errs.length || !def) return { ok: false, error: errs.join("; "), descriptor };
  return { ok: true, config: { provider: def.id, baseUrl, model, apiKey, timeoutMs, maxOutputTokens, effort: effortRaw } };
}

export function publicDescriptor(c: OrionModelConfig): PublicDescriptor {
  const d = PROVIDERS[c.provider];
  return { configured: true, provider: c.provider, providerName: d.displayName, host: new URL(c.baseUrl).host, model: c.model, effort: c.effort ?? null, timeoutMs: c.timeoutMs, schemaEnforced: d.enforcesSchema };
}
