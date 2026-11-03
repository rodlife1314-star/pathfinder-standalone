/**
 * ORION model adapter tests. All HTTP is a scripted fake — these test the
 * adapter's handling of responses and failures, NOT the real model's behaviour.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readOrionConfig, publicDescriptor, type OrionModelConfig } from "../src/orion/model/config.ts";
import { callChatCompletion, type FetchLike } from "../src/orion/model/client.ts";
import { askOrionModel } from "../src/orion/model/service.ts";
import { admitModelOutput, findNumericalClaims } from "../src/orion/model/admission.ts";
import { redact } from "../src/orion/model/redact.ts";

const KEY = "nvapi-TESTKEY_abcdefghijklmnopqrstuvwxyz0123456789";
const CFG: OrionModelConfig = { baseUrl: "https://example.invalid/v1", model: "z-ai/glm-5.3-flash", apiKey: KEY, timeoutMs: 200, maxTokens: 256, temperature: 0.5 };
const fixedClock = () => new Date("2026-11-03T00:00:00Z");

type Scripted = { status?: number; statusText?: string; body?: string; headers?: Record<string, string>; throws?: Error; hang?: boolean };
function fakeFetch(s: Scripted, seen: { url?: string; init?: Parameters<FetchLike>[1] } = {}): FetchLike {
  return (url, init) => {
    seen.url = url; seen.init = init;
    if (s.hang) return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    if (s.throws) return Promise.reject(s.throws);
    const status = s.status ?? 200;
    return Promise.resolve({
      ok: status >= 200 && status < 300, status, statusText: s.statusText ?? "", headers: { get: (n: string) => s.headers?.[n.toLowerCase()] ?? null },
      text: () => Promise.resolve(s.body ?? ""),
    });
  };
}
const completion = (content: string, model = "z-ai/glm-5.3-flash", finish = "stop") =>
  JSON.stringify({ id: "cmpl-1", model, choices: [{ message: { role: "assistant", content }, finish_reason: finish }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } });
const goodJson = JSON.stringify({ evidenceClass: "UNVERIFIED_AI_EXPLANATION", title: "Precession", sections: [{ heading: "Explanation", lines: ["ω circles the symmetry axis."] }], assumptions: ["rigid body"], openQuestions: [], proposedExperiments: [] });
const noKey = (x: unknown) => assert.ok(!JSON.stringify(x).includes(KEY) && !JSON.stringify(x).includes("TESTKEY"), "API key leaked into output");

// ── configuration ──
test("config: missing key is reported without exposing anything secret", () => {
  const r = readOrionConfig({});
  assert.equal(r.ok, false);
  if (!r.ok) { assert.match(r.error, /ORION_API_KEY/); assert.equal(r.descriptor.configured, false); assert.equal(r.descriptor.model, "z-ai/glm-5.3-flash"); }
});
test("config: rejects non-https base URL and out-of-range timeout", () => {
  const r = readOrionConfig({ ORION_API_KEY: KEY, ORION_BASE_URL: "http://x.example/v1", ORION_TIMEOUT_MS: "5" });
  assert.equal(r.ok, false);
  if (!r.ok) { assert.match(r.error, /https/); assert.match(r.error, /TIMEOUT/); noKey(r); }
});
test("config: public descriptor never contains the key", () => {
  const r = readOrionConfig({ ORION_API_KEY: KEY });
  assert.ok(r.ok);
  if (r.ok) { noKey(publicDescriptor(r.config)); assert.equal(publicDescriptor(r.config).provider, "integrate.api.nvidia.com"); }
});

// ── request shape ──
test("request: POST to /chat/completions with bearer auth and OpenAI-compatible body", async () => {
  const seen: { url?: string; init?: Parameters<FetchLike>[1] } = {};
  await callChatCompletion(CFG, [{ role: "user", content: "hi" }], { fetchImpl: fakeFetch({ body: completion("x") }, seen) });
  assert.equal(seen.url, "https://example.invalid/v1/chat/completions");
  assert.equal(seen.init?.method, "POST");
  assert.equal(seen.init?.headers.authorization, `Bearer ${KEY}`);
  const body = JSON.parse(seen.init!.body);
  assert.deepEqual({ model: body.model, stream: body.stream, max_tokens: body.max_tokens, temperature: body.temperature }, { model: "z-ai/glm-5.3-flash", stream: false, max_tokens: 256, temperature: 0.5 });
});

// ── failure modes ──
test("failure: timeout aborts and is reported as timeout", async () => {
  const r = await callChatCompletion(CFG, [], { fetchImpl: fakeFetch({ hang: true }) });
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.kind, "timeout"); assert.ok(r.latencyMs >= 150); }
});
test("failure: network error", async () => {
  const r = await callChatCompletion(CFG, [], { fetchImpl: fakeFetch({ throws: new TypeError("fetch failed: ECONNREFUSED") }) });
  assert.ok(!r.ok && r.kind === "network");
});
test("failure: 401 echoing the key is classified auth and redacted", async () => {
  const r = await callChatCompletion(CFG, [], { fetchImpl: fakeFetch({ status: 401, statusText: "Unauthorized", body: `{"error":"invalid key ${KEY}","authorization":"Bearer ${KEY}"}` }) });
  assert.ok(!r.ok && r.kind === "auth" && r.httpStatus === 401);
  noKey(r);
  if (!r.ok) assert.match(r.message, /REDACTED/);
});
test("failure: 403 auth, 429 rate-limited, 500 http", async () => {
  for (const [status, kind] of [[403, "auth"], [429, "rate-limited"], [500, "http"], [503, "http"]] as const) {
    const r = await callChatCompletion(CFG, [], { fetchImpl: fakeFetch({ status, body: "error" }) });
    assert.ok(!r.ok && r.kind === kind, `${status}`);
  }
});
test("failure: non-JSON, missing choices, non-string content, empty content", async () => {
  const cases: [string, string][] = [
    ["<html>gateway</html>", "invalid-response"],
    [JSON.stringify({ choices: [] }), "invalid-response"],
    [JSON.stringify({ choices: [{ message: { content: null } }] }), "invalid-response"],
    [completion("   "), "empty-response"],
  ];
  for (const [body, kind] of cases) {
    const r = await callChatCompletion(CFG, [], { fetchImpl: fakeFetch({ body }) });
    assert.ok(!r.ok && r.kind === kind, body);
  }
});
test("failure: overlong error bodies are truncated", async () => {
  const r = await callChatCompletion(CFG, [], { fetchImpl: fakeFetch({ status: 500, body: "x".repeat(5000) }) });
  assert.ok(!r.ok && r.message.length < 700);
});

// ── service: end-to-end through admission ──
test("service: successful structured answer is ANSWERED, traced and UNVERIFIED", async () => {
  const r = await askOrionModel(CFG, { kind: "scientific-question", text: "Why does a disk precess?" },
    { fetchImpl: fakeFetch({ body: completion(goodJson), headers: { "x-request-id": "req-42" } }), clock: fixedClock });
  assert.equal(r.outcome, "ANSWERED");
  assert.equal(r.provider.reportedModel, "z-ai/glm-5.3-flash");
  assert.equal(r.call.providerRequestId, "req-42");
  assert.equal(r.call.usage?.totalTokens, 30);
  assert.equal(r.admitted?.disposition, "ADMITTED");
  assert.match(r.rawContentSha256 ?? "", /^[0-9a-f]{64}$/);
  assert.equal(r.quarantinedRawText, null);
  assert.deepEqual(r.verification, { status: "UNVERIFIED", evaluatedByCrucible: false, calculationsPerformedByOrion: false });
  assert.ok(r.trace.some((s) => /UNVERIFIED/.test(s.step)));
  noKey(r);
});
test("service: API failure becomes outcome ERROR with no key in output", async () => {
  const r = await askOrionModel(CFG, { kind: "explain-equation", text: "Euler" }, { fetchImpl: fakeFetch({ status: 401, body: KEY }), clock: fixedClock });
  assert.equal(r.outcome, "ERROR");
  assert.equal(r.error?.kind, "auth");
  assert.equal(r.admitted, null);
  noKey(r);
});
test("service: reported-model mismatch and truncation are warned in the trace", async () => {
  const r = await askOrionModel(CFG, { kind: "scientific-question", text: "q" }, { fetchImpl: fakeFetch({ body: completion(goodJson, "other/model", "length") }), clock: fixedClock });
  assert.ok(r.trace.some((s) => /differs from requested/.test(s.step)));
  assert.ok(r.trace.some((s) => /truncated/.test(s.step)));
});
test("service: model claiming ESTABLISHED_LAW is REJECTED and quarantined", async () => {
  const bad = JSON.stringify({ evidenceClass: "ESTABLISHED_LAW", title: "x", sections: [] });
  const r = await askOrionModel(CFG, { kind: "scientific-question", text: "q" }, { fetchImpl: fakeFetch({ body: completion(bad) }), clock: fixedClock });
  assert.equal(r.outcome, "REJECTED");
  assert.match(r.admitted?.rejectionReason ?? "", /ESTABLISHED_LAW/);
  assert.equal(r.quarantinedRawText, bad);
});

// ── admission details ──
test("admission: self-declared validation status is rejected", () => {
  const a = admitModelOutput("scientific-question", JSON.stringify({ evidenceClass: "HYPOTHESIS", status: "PASSED", title: "t", sections: [] }));
  assert.equal(a.disposition, "REJECTED");
});
test("admission: prose output is kept but forced to UNVERIFIED_AI_EXPLANATION", () => {
  const a = admitModelOutput("scientific-question", "The disk precesses because L is conserved.");
  assert.equal(a.disposition, "ADMITTED_UNSTRUCTURED");
  assert.equal(a.evidenceClass, "UNVERIFIED_AI_EXPLANATION");
});
test("admission: fenced JSON is parsed", () => {
  assert.equal(admitModelOutput("scientific-question", "```json\n" + goodJson + "\n```").disposition, "ADMITTED");
});
test("admission: numerical statements and validation language are flagged", () => {
  const txt = JSON.stringify({ evidenceClass: "UNVERIFIED_AI_EXPLANATION", title: "t", sections: [{ heading: "h", lines: ["9.11 is larger than 9.8.", "The design is validated and will levitate."] }] });
  const a = admitModelOutput("scientific-question", txt);
  assert.ok(a.numericalClaims.some((s) => s.includes("9.11")));
  assert.ok(a.validationLanguage.includes("validated") && a.validationLanguage.includes("will levitate"));
  assert.deepEqual(findNumericalClaims("I₁ω̇₁ = τ₁ − (I₃ − I₂)ω₂ω₃"), []);
});
test("redaction covers common credential shapes", () => {
  const s = redact(`key ${KEY} Bearer abc.def-123456 api_key=zzzzzzzz sk-${"a".repeat(20)}`);
  assert.ok(!/nvapi-|abc\.def|zzzzzzzz|sk-a/.test(s), s);
});
