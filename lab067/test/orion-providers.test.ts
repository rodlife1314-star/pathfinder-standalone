/**
 * Provider adapter tests. All HTTP is scripted. Response fixtures are transcribed
 * from each provider's documented response shape — they test our request
 * building and parsing, NOT any model's behaviour or the live API.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PROVIDERS } from "../src/orion/providers/registry.ts";
import { sendRequest, type FetchLike } from "../src/orion/providers/transport.ts";
import { readOrionConfig, publicDescriptor, type OrionModelConfig } from "../src/orion/model/config.ts";
import { askOrionModel } from "../src/orion/model/service.ts";
import { redact } from "../src/orion/model/redact.ts";
import { ORION_RESPONSE_SCHEMA } from "../src/orion/model/schema.ts";

const KEY = "sk-TESTKEY_abcdefghijklmnopqrstuvwxyz0123456789";
const REQ = { system: "S", user: "U", responseSchema: ORION_RESPONSE_SCHEMA as unknown as Record<string, unknown>, schemaName: "orion_response", maxOutputTokens: 1000, effort: "high" };
const good = JSON.stringify({ evidenceClass: "UNVERIFIED_AI_EXPLANATION", title: "t", verdict: "SUPPORTED", sections: [{ heading: "h", lines: ["l"] }], answerValues: [], assumptions: [], uncertainty: ["u"], openQuestions: [], proposedExperiments: [] });
const noKey = (x: unknown) => { const s = JSON.stringify(x); assert.ok(!s.includes(KEY) && !s.includes("TESTKEY"), "API key leaked"); };

type Scripted = { status?: number; body?: string; headers?: Record<string, string>; throws?: Error; hang?: boolean };
function fake(s: Scripted, seen: { url?: string; init?: Parameters<FetchLike>[1] } = {}): FetchLike {
  return (url, init) => {
    seen.url = url; seen.init = init;
    if (s.hang) return new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))));
    if (s.throws) return Promise.reject(s.throws);
    const status = s.status ?? 200;
    return Promise.resolve({ ok: status < 300, status, statusText: "", headers: { get: (n: string) => s.headers?.[n.toLowerCase()] ?? null }, text: () => Promise.resolve(s.body ?? "") });
  };
}

// ── request shapes ──
test("anthropic request: /v1/messages, x-api-key, anthropic-version, output_config.format + effort, no temperature", () => {
  const r = PROVIDERS.anthropic.buildRequest("https://api.anthropic.com", "claude-sonnet-5-5", KEY, REQ);
  assert.equal(r.url, "https://api.anthropic.com/v1/messages");
  assert.equal(r.headers["x-api-key"], KEY);
  assert.equal(r.headers["anthropic-version"], "2026-10-21");
  const oc = r.body.output_config as { format: { type: string; schema: unknown }; effort: string };
  assert.equal(oc.format.type, "json_schema");
  assert.equal(oc.effort, "high");
  assert.equal(r.body.system, "S");
  assert.ok(!("temperature" in r.body) && !("thinking" in r.body));
});
test("openai request: /responses, bearer, text.format json_schema strict, reasoning.effort, store false", () => {
  const r = PROVIDERS.openai.buildRequest("https://api.openai.com/v1", "gpt-6.1-sol", KEY, REQ);
  assert.equal(r.url, "https://api.openai.com/v1/responses");
  assert.equal(r.headers.authorization, `Bearer ${KEY}`);
  assert.deepEqual((r.body.text as { format: { type: string; strict: boolean; name: string } }).format.strict, true);
  assert.deepEqual(r.body.reasoning, { effort: "high" });
  assert.equal(r.body.store, false);
  assert.equal(r.body.instructions, "S");
});
test("gemini request: generateContent, x-goog-api-key, responseJsonSchema, thinkingLevel upper-cased", () => {
  const r = PROVIDERS.gemini.buildRequest("https://generativelanguage.googleapis.com", "gemini-4-argon", KEY, REQ);
  assert.equal(r.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-4-argon:generateContent");
  assert.equal(r.headers["x-goog-api-key"], KEY);
  const gc = r.body.generationConfig as Record<string, unknown>;
  assert.equal(gc.responseMimeType, "application/json");
  assert.ok(gc.responseJsonSchema);
  assert.deepEqual(gc.thinkingConfig, { thinkingLevel: "HIGH" });
});
test("openai-compatible request embeds the schema in the prompt (not enforced)", () => {
  const r = PROVIDERS["openai-compatible"].buildRequest("https://example.invalid/v1", "m", KEY, { ...REQ, effort: undefined });
  assert.equal(r.url, "https://example.invalid/v1/chat/completions");
  assert.match(JSON.stringify(r.body.messages), /JSON Schema/);
  assert.equal(PROVIDERS["openai-compatible"].enforcesSchema, false);
});
test("schema is strict-mode compatible: every object closed and fully required", () => {
  const walk = (s: Record<string, unknown>, path: string) => {
    if (s.type === "object") {
      assert.equal(s.additionalProperties, false, path);
      assert.deepEqual([...(s.required as string[])].sort(), Object.keys(s.properties as object).sort(), path);
      for (const [k, v] of Object.entries(s.properties as Record<string, Record<string, unknown>>)) walk(v, `${path}.${k}`);
    }
    if (s.type === "array") walk(s.items as Record<string, unknown>, `${path}[]`);
    for (const bad of ["minimum", "maximum", "minLength", "maxLength", "multipleOf"]) assert.ok(!(bad in s), `${path}.${bad}`);
  };
  walk(ORION_RESPONSE_SCHEMA as unknown as Record<string, unknown>, "$");
});

// ── response parsing ──
test("anthropic parse: text blocks, model, usage; refusal and max_tokens classified", () => {
  const p = PROVIDERS.anthropic.parseResponse({ id: "msg_1", model: "claude-sonnet-5-5", stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: good }], usage: { input_tokens: 5, output_tokens: 7 } });
  assert.ok(p.ok && p.completion.text === good && p.completion.reportedModel === "claude-sonnet-5-5" && p.completion.stop === "complete");
  const ref = PROVIDERS.anthropic.parseResponse({ stop_reason: "refusal", stop_details: { category: "cyber" }, content: [] });
  assert.ok(!ref.ok && ref.kind === "refusal" && /cyber/.test(ref.message));
  assert.ok(!PROVIDERS.anthropic.parseResponse({ stop_reason: "max_tokens", content: [{ type: "text", text: "{" }] }).ok);
});
test("openai parse: output_text, reasoning tokens; refusal content and incomplete status classified", () => {
  const p = PROVIDERS.openai.parseResponse({ id: "resp_1", model: "gpt-6.1-sol", status: "completed", output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: good }] }], usage: { input_tokens: 3, output_tokens: 9, output_tokens_details: { reasoning_tokens: 4 } } });
  assert.ok(p.ok && p.completion.usage.reasoningTokens === 4);
  const ref = PROVIDERS.openai.parseResponse({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] });
  assert.ok(!ref.ok && ref.kind === "refusal");
  const inc = PROVIDERS.openai.parseResponse({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [] });
  assert.ok(!inc.ok && inc.kind === "incomplete");
});
test("gemini parse: skips thought parts; prompt block, SAFETY and MAX_TOKENS classified", () => {
  const p = PROVIDERS.gemini.parseResponse({ responseId: "r1", modelVersion: "gemini-4-argon", candidates: [{ finishReason: "STOP", content: { parts: [{ text: "thinking…", thought: true }, { text: good }] } }], usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 6, thoughtsTokenCount: 11 } });
  assert.ok(p.ok && p.completion.text === good && p.completion.usage.reasoningTokens === 11);
  assert.ok(!PROVIDERS.gemini.parseResponse({ promptFeedback: { blockReason: "SAFETY" } }).ok);
  const s = PROVIDERS.gemini.parseResponse({ candidates: [{ finishReason: "SAFETY" }] });
  assert.ok(!s.ok && s.kind === "refusal");
  const m = PROVIDERS.gemini.parseResponse({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [] } }] });
  assert.ok(!m.ok && m.kind === "incomplete");
});

// ── transport failure modes (provider-agnostic) ──
const P = PROVIDERS.anthropic;
const spec = P.buildRequest("https://example.invalid", "m", KEY, REQ);
test("transport: timeout, network, 401/403 auth (redacted), 429, 5xx, non-JSON, oversized body", async () => {
  const run = (s: Scripted) => sendRequest(P, spec, { timeoutMs: 150, secrets: [KEY], fetchImpl: fake(s) });
  const t = await run({ hang: true }); assert.ok(!t.ok && t.kind === "timeout");
  const n = await run({ throws: new TypeError("fetch failed") }); assert.ok(!n.ok && n.kind === "network");
  const a = await run({ status: 401, body: `{"error":"bad key ${KEY}"}` }); assert.ok(!a.ok && a.kind === "auth"); noKey(a);
  for (const [st, k] of [[403, "auth"], [429, "rate-limited"], [500, "http"], [529, "http"]] as const) { const r = await run({ status: st, body: "e" }); assert.ok(!r.ok && r.kind === k, String(st)); }
  const j = await run({ body: "<html>" }); assert.ok(!j.ok && j.kind === "invalid-response");
  const big = await run({ status: 500, body: "x".repeat(5000) }); assert.ok(!big.ok && big.message.length < 700);
});
test("transport: provider request id captured from documented header", async () => {
  const r = await sendRequest(P, spec, { timeoutMs: 1000, secrets: [KEY], fetchImpl: fake({ body: JSON.stringify({ content: [{ type: "text", text: good }], stop_reason: "end_turn" }), headers: { "request-id": "req_9" } }) });
  assert.ok(r.ok && r.providerRequestId === "req_9");
});

// ── configuration ──
test("config: no default provider or model — both must be chosen", () => {
  const r = readOrionConfig({ ORION_API_KEY: KEY });
  assert.ok(!r.ok && /ORION_PROVIDER/.test(r.error) && /ORION_MODEL/.test(r.error));
  if (!r.ok) noKey(r);
});
test("config: official default host per provider; openai-compatible requires a base URL", () => {
  for (const [p, host] of [["anthropic", "api.anthropic.com"], ["openai", "api.openai.com"], ["gemini", "generativelanguage.googleapis.com"]] as const) {
    const r = readOrionConfig({ ORION_PROVIDER: p, ORION_MODEL: "m", ORION_API_KEY: KEY });
    assert.ok(r.ok, p); if (r.ok) { assert.equal(publicDescriptor(r.config).host, host); noKey(publicDescriptor(r.config)); }
  }
  const oc = readOrionConfig({ ORION_PROVIDER: "openai-compatible", ORION_MODEL: "m", ORION_API_KEY: KEY });
  assert.ok(!oc.ok && /ORION_BASE_URL is required/.test(oc.error));
});
test("config: effort validated per provider; http, unknown provider and out-of-range limits rejected", () => {
  assert.ok(readOrionConfig({ ORION_PROVIDER: "anthropic", ORION_MODEL: "m", ORION_API_KEY: KEY, ORION_EFFORT: "xhigh" }).ok);
  assert.ok(!readOrionConfig({ ORION_PROVIDER: "gemini", ORION_MODEL: "m", ORION_API_KEY: KEY, ORION_EFFORT: "xhigh" }).ok);
  assert.ok(!readOrionConfig({ ORION_PROVIDER: "openai-compatible", ORION_MODEL: "m", ORION_API_KEY: KEY, ORION_BASE_URL: "https://x.example", ORION_EFFORT: "high" }).ok);
  assert.ok(!readOrionConfig({ ORION_PROVIDER: "anthropic", ORION_MODEL: "m", ORION_API_KEY: KEY, ORION_BASE_URL: "http://api.anthropic.com" }).ok);
  assert.ok(!readOrionConfig({ ORION_PROVIDER: "nvidia", ORION_MODEL: "m", ORION_API_KEY: KEY }).ok);
  assert.ok(!readOrionConfig({ ORION_PROVIDER: "anthropic", ORION_MODEL: "m", ORION_API_KEY: KEY, ORION_TIMEOUT_MS: "10" }).ok);
});

// ── service: same ORION behaviour whichever provider ──
test("service: identical admission and verification for all three schema-enforcing providers", async () => {
  const bodies: Record<string, unknown> = {
    anthropic: { id: "a", model: "claude-x", stop_reason: "end_turn", content: [{ type: "text", text: good }], usage: {} },
    openai: { id: "o", model: "gpt-x", status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: good }] }] },
    gemini: { responseId: "g", modelVersion: "gemini-x", candidates: [{ finishReason: "STOP", content: { parts: [{ text: good }] } }] },
  };
  const verdicts = new Set<string>();
  for (const [p, body] of Object.entries(bodies)) {
    const c = readOrionConfig({ ORION_PROVIDER: p, ORION_MODEL: "x", ORION_API_KEY: KEY });
    assert.ok(c.ok);
    if (!c.ok) continue;
    const r = await askOrionModel(c.config, { kind: "scientific-question", text: "q" }, { fetchImpl: fake({ body: JSON.stringify(body) }) });
    assert.equal(r.outcome, "ANSWERED", p);
    assert.equal(r.admitted?.disposition, "ADMITTED", p);
    assert.deepEqual(r.verification, { status: "UNVERIFIED", evaluatedByCrucible: false, calculationsPerformedByOrion: false });
    verdicts.add(r.admitted!.verdict);
    noKey(r);
  }
  assert.deepEqual([...verdicts], ["SUPPORTED"]);
});
test("service: refusal surfaces as ERROR kind refusal; model claiming ESTABLISHED_LAW is REJECTED", async () => {
  const c = readOrionConfig({ ORION_PROVIDER: "anthropic", ORION_MODEL: "x", ORION_API_KEY: KEY });
  assert.ok(c.ok); if (!c.ok) return;
  const r1 = await askOrionModel(c.config, { kind: "scientific-question", text: "q" }, { fetchImpl: fake({ body: JSON.stringify({ stop_reason: "refusal", content: [] }) }) });
  assert.equal(r1.error?.kind, "refusal");
  const bad = JSON.stringify({ ...JSON.parse(good), evidenceClass: "ESTABLISHED_LAW" });
  const r2 = await askOrionModel(c.config, { kind: "scientific-question", text: "q" }, { fetchImpl: fake({ body: JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: bad }] }) }) });
  assert.equal(r2.outcome, "REJECTED");
  assert.equal(r2.quarantinedRawText, bad);
});
test("redaction covers Anthropic, OpenAI, Google and bearer key shapes", () => {
  const s = redact(`sk-ant-api03-${"a".repeat(30)} sk-proj-${"b".repeat(30)} AIza${"c".repeat(30)} Bearer abc.def-123456 x-api-key: zzzzzzzz`);
  assert.ok(!/aaaa|bbbb|cccc|abc\.def|zzzzzzzz/.test(s), s);
});
