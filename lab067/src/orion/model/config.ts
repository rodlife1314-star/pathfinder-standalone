/**
 * ORION model-endpoint configuration (Phase 002a, development branch).
 * Read from server environment variables only. The API key never leaves the
 * server: `publicDescriptor` is the only view that may be sent to a browser.
 */
export interface OrionModelConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
}

export interface PublicDescriptor {
  configured: boolean;
  provider: string;
  model: string;
  timeoutMs: number;
}

export type ConfigResult = { ok: true; config: OrionModelConfig } | { ok: false; error: string; descriptor: PublicDescriptor };

export const DEFAULTS = {
  baseUrl: "https://integrate.api.nvidia.com/v1",
  model: "z-ai/glm-5.3-flash",
  timeoutMs: 30_000,
  maxTokens: 1024,
  temperature: 0.5,
} as const;

function num(raw: string | undefined, def: number, lo: number, hi: number, name: string, errs: string[]): number {
  if (raw === undefined || raw.trim() === "") return def;
  const v = Number(raw);
  if (!Number.isFinite(v) || v < lo || v > hi) { errs.push(`${name} must be a number in [${lo}, ${hi}]`); return def; }
  return v;
}

export function readOrionConfig(env: Record<string, string | undefined>): ConfigResult {
  const errs: string[] = [];
  const baseUrl = (env.ORION_BASE_URL?.trim() || DEFAULTS.baseUrl).replace(/\/+$/, "");
  const model = env.ORION_MODEL?.trim() || DEFAULTS.model;
  const apiKey = env.ORION_API_KEY?.trim() ?? "";
  const timeoutMs = num(env.ORION_TIMEOUT_MS, DEFAULTS.timeoutMs, 1_000, 120_000, "ORION_TIMEOUT_MS", errs);
  const maxTokens = num(env.ORION_MAX_TOKENS, DEFAULTS.maxTokens, 64, 8_192, "ORION_MAX_TOKENS", errs);
  const temperature = num(env.ORION_TEMPERATURE, DEFAULTS.temperature, 0, 2, "ORION_TEMPERATURE", errs);
  let host = "invalid";
  try {
    const u = new URL(baseUrl);
    host = u.host;
    if (u.protocol !== "https:") errs.push("ORION_BASE_URL must use https");
  } catch { errs.push("ORION_BASE_URL is not a valid URL"); }
  if (!apiKey) errs.push("ORION_API_KEY is not set on the server");
  const descriptor: PublicDescriptor = { configured: errs.length === 0, provider: host, model, timeoutMs };
  if (errs.length) return { ok: false, error: errs.join("; "), descriptor };
  return { ok: true, config: { baseUrl, model, apiKey, timeoutMs, maxTokens, temperature } };
}

export function publicDescriptor(c: OrionModelConfig): PublicDescriptor {
  return { configured: true, provider: new URL(c.baseUrl).host, model: c.model, timeoutMs: c.timeoutMs };
}
