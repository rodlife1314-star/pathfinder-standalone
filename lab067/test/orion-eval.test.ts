/**
 * Evaluation-harness tests. These verify the CASES and GRADERS with hand-written
 * fixture answers — they say nothing about any real model's capability.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { EVAL_CASES } from "../src/orion/eval/cases.ts";
import { gradeCase } from "../src/orion/eval/grade.ts";
import { runEvaluation } from "../src/orion/eval/runner.ts";
import { askOrionModel } from "../src/orion/model/service.ts";
import { readOrionConfig } from "../src/orion/model/config.ts";
import type { FetchLike } from "../src/orion/providers/transport.ts";

const KEY = "sk-EVALTEST_abcdefghijklmnopqrstuvwxyz";
const cfg = (() => { const c = readOrionConfig({ ORION_PROVIDER: "anthropic", ORION_MODEL: "fixture-model", ORION_API_KEY: KEY }); if (!c.ok) throw new Error(c.error); return c.config; })();
const answer = (o: Record<string, unknown>) => JSON.stringify({ evidenceClass: "UNVERIFIED_AI_EXPLANATION", title: "t", verdict: "SUPPORTED", sections: [], answerValues: [], assumptions: [], uncertainty: [], openQuestions: [], proposedExperiments: [], ...o });
const fetchReturning = (text: string): FetchLike => () => Promise.resolve({ ok: true, status: 200, statusText: "", headers: { get: () => null }, text: () => Promise.resolve(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text }] })) });
const grade = async (id: string, text: string) => {
  const c = EVAL_CASES.find((x) => x.id === id)!;
  return gradeCase(c, await askOrionModel(cfg, { kind: c.kind, text: c.prompt }, { fetchImpl: fetchReturning(text) }));
};

test("eval set covers every requested category, ids unique, references engine-computed", () => {
  const cats = new Set(EVAL_CASES.map((c) => c.category));
  for (const k of ["euler-dynamics", "conservation", "dimensional", "uncertainty", "false-hypothesis"]) assert.ok(cats.has(k as never), k);
  assert.equal(new Set(EVAL_CASES.map((c) => c.id)).size, EVAL_CASES.length);
  const euler = EVAL_CASES.find((c) => c.id === "euler.asymmetric-omega-dot")!;
  assert.deepEqual(euler.expectValues.map((v) => v.value), [-1, 1, -1 / 3]);
  assert.ok(Math.abs(EVAL_CASES.find((c) => c.id === "euler.symmetric-top-precession")!.expectValues[0]!.value - 7.5) < 1e-12);
  assert.equal(EVAL_CASES.find((c) => c.id === "dim.fast-top-rate")!.expectValues[0]!.value, -0.125);
});

test("grader passes a correct Euler answer and fails a sign error", async () => {
  const ok = await grade("euler.asymmetric-omega-dot", answer({ answerValues: [{ name: "omega_dot_1", value: -1, unit: "rad/s^2" }, { name: "omega_dot_2", value: 1, unit: "rad/s^2" }, { name: "omega_dot_3", value: -0.3333, unit: "rad/s^2" }] }));
  assert.ok(ok.pass, JSON.stringify(ok.checks));
  const bad = await grade("euler.asymmetric-omega-dot", answer({ answerValues: [{ name: "omega_dot_1", value: 1, unit: "rad/s^2" }, { name: "omega_dot_2", value: 1, unit: "rad/s^2" }, { name: "omega_dot_3", value: -0.3333, unit: "rad/s^2" }] }));
  assert.ok(!bad.pass);
});

test("grader: false hypothesis must be CONTRADICTED; '9.11 > 9.8' must yield 9.8", async () => {
  assert.ok((await grade("false.energy-generation", answer({ verdict: "CONTRADICTED_BY_ESTABLISHED_LAW" }))).pass);
  assert.ok(!(await grade("false.energy-generation", answer({ verdict: "SUPPORTED" }))).pass);
  assert.ok((await grade("false.decimal-comparison", answer({ verdict: "CONTRADICTED_BY_ESTABLISHED_LAW", answerValues: [{ name: "larger_number", value: 9.8, unit: "1" }] }))).pass);
  assert.ok(!(await grade("false.decimal-comparison", answer({ verdict: "SUPPORTED", answerValues: [{ name: "larger_number", value: 9.11, unit: "1" }] }))).pass);
});

test("grader: uncertainty case fails on an invented citation or missing uncertainty", async () => {
  assert.ok((await grade("unc.holmium-saturation", answer({ verdict: "UNDETERMINED", uncertainty: ["No sourced value available"] }))).pass);
  assert.ok(!(await grade("unc.holmium-saturation", answer({ verdict: "UNDETERMINED", uncertainty: ["x"], sections: [{ heading: "Ref", lines: ["See doi:10.1234/fake.5678"] }] }))).pass);
  assert.ok(!(await grade("unc.holmium-saturation", answer({ verdict: "UNDETERMINED" }))).pass);
});

test("grader: validation language and unstructured output fail", async () => {
  assert.ok(!(await grade("false.static-levitation", answer({ verdict: "CONTRADICTED_BY_ESTABLISHED_LAW", sections: [{ heading: "h", lines: ["This is validated."] }] }))).pass);
  assert.ok(!(await grade("false.static-levitation", "Earnshaw forbids it.")).pass);
});

test("runner: records configuration without credentials, marks fixture runs as not live", async () => {
  const rec = await runEvaluation(cfg, { fetchImpl: fetchReturning(answer({})) });
  assert.equal(rec.liveCall, false);
  assert.equal(rec.summary.cases, EVAL_CASES.length);
  assert.equal(rec.configuration.provider, "anthropic");
  assert.ok(!JSON.stringify(rec).includes(KEY));
  for (const r of rec.results) assert.match(r.response.inputSha256, /^[0-9a-f]{64}$/);
});
