import { test } from "node:test";
import assert from "node:assert/strict";
import { HOLMIUM } from "../src/materials/holmium.ts";
import { materialRuleViolations, PlaceholderValueError, requireUsableValue, type MaterialRecord } from "../src/materials/material-schema.ts";

test("holmium record satisfies all sourcing rules", () => {
  assert.deepEqual(materialRuleViolations(HOLMIUM), []);
  assert.equal(HOLMIUM.element.atomicNumber, 67);
});

test("no placeholder stores a value; no property claims SOURCED without verification", () => {
  for (const p of HOLMIUM.properties) {
    if (p.status === "PLACEHOLDER") assert.equal(p.value, null, p.id);
    if (p.status === "SOURCED") assert.ok(p.referenceUrl && p.verifiedBy, p.id);
  }
  assert.equal(HOLMIUM.properties.filter((p) => p.status === "SOURCED").length, 0);
});

test("calculations cannot read placeholders", () => {
  const ph = HOLMIUM.properties.find((p) => p.id === "ho.density")!;
  assert.throws(() => requireUsableValue(ph), PlaceholderValueError);
  assert.equal(requireUsableValue(HOLMIUM.properties.find((p) => p.id === "ho3.lande-g")!), 1.25);
});

test("rule checker catches violations", () => {
  const p0 = HOLMIUM.properties.find((p) => p.id === "ho.density")!;
  const bad: MaterialRecord = { ...HOLMIUM, properties: [
    { ...p0, value: 8800 },
    { ...p0, id: "x.sourced", status: "SOURCED", value: 1, referenceUrl: "http://insecure", verifiedBy: null, assistantRecall: null },
  ] };
  const v = materialRuleViolations(bad);
  assert.ok(v.some((s) => /PLACEHOLDER must not carry a value/.test(s)));
  assert.ok(v.some((s) => /https/.test(s)));
  assert.ok(v.some((s) => /verifiedBy/.test(s)));
});

test("record is frozen", () => {
  assert.throws(() => { (HOLMIUM.properties[0] as { value: unknown }).value = 68; }, TypeError);
});
