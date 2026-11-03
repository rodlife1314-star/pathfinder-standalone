import { test } from "node:test";
import assert from "node:assert/strict";
import { askOrion, responseToProposal } from "../src/orion/console.ts";
import { admitOrionProposal } from "../src/orion/contract.ts";
import { KNOWLEDGE } from "../src/orion/knowledge.ts";

test("matches templates deterministically and states no model ran", () => {
  const r = askOrion({ kind: "scientific-question", text: "Why does a spinning disk precess?" });
  assert.equal(r.templateId, "precession");
  assert.equal(r.noModelExecuted, true);
  assert.equal(r.noCalculationPerformed, true);
  assert.ok(r.trace.some((t) => /No language model executed/.test(t)));
  assert.deepEqual(askOrion({ kind: "scientific-question", text: "Why does a spinning disk precess?" }), r);
});

test("unmatched question is reported honestly, not answered", () => {
  const r = askOrion({ kind: "scientific-question", text: "What is the GDP of Peru?" });
  assert.equal(r.matched, false);
  assert.deepEqual(r.openQuestions, ["What is the GDP of Peru?"]);
});

test("energy-generation questions get the conservation constraint", () => {
  const r = askOrion({ kind: "scientific-question", text: "Can the disk generate free energy?" });
  assert.equal(r.templateId, "energy-constraints");
});

test("short keywords need word boundaries ('ho' must not match 'how')", () => {
  const r = askOrion({ kind: "scientific-question", text: "how should I think about this" });
  assert.equal(r.matched, false);
});

test("experiment proposals are HYPOTHESIS and pass the contract guard", () => {
  const r = askOrion({ kind: "propose-experiment", text: "intermediate axis stability" });
  assert.equal(r.evidenceClass, "HYPOTHESIS");
  const p = admitOrionProposal(responseToProposal(r));
  assert.equal(p.kind, "suggest-numerical-experiment");
});

test("templates contain no computed numbers claimed as results", () => {
  for (const t of KNOWLEDGE) assert.ok(!/\bPASSED\b|\bvalidated\b/i.test(JSON.stringify(t)), t.id);
});
