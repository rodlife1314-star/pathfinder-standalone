import type { ProviderDefinition, ProviderId } from "./types.ts";
import { anthropicProvider } from "./anthropic.ts";
import { openaiProvider } from "./openai.ts";
import { geminiProvider } from "./gemini.ts";
import { openaiCompatibleProvider } from "./openai-compatible.ts";

export const PROVIDERS: Readonly<Record<ProviderId, ProviderDefinition>> = Object.freeze({
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  "openai-compatible": openaiCompatibleProvider,
});

export const isProviderId = (x: string): x is ProviderId => Object.hasOwn(PROVIDERS, x);
