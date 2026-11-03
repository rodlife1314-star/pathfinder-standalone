import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REGISTRY } from "../src/registry/references.ts";
import { LAB_VERSION } from "../src/contracts/version.ts";
import { D, sameDim } from "../src/units/dimension.ts";

test("registry ids are unique and records are frozen", () => {
  const ids = REGISTRY.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.throws(() => { (REGISTRY[0] as { title: string }).title = "x"; }, TypeError);
  assert.throws(() => { (REGISTRY as unknown as unknown[]).push({}); }, TypeError);
});

test("no AI-recalled or computed record claims Operator verification", () => {
  for (const r of REGISTRY) {
    if (r.origin !== "OPERATOR") assert.notEqual(r.citation.status, "OPERATOR_VERIFIED", r.id);
    if (r.citation.status === "NONE") assert.equal(r.citation.source, null, r.id);
  }
});

test("quantities carry a dimension consistent with their unit", () => {
  const unitDims: Record<string, readonly number[]> = { K: D.temperature, "J/T": D.magneticMoment, "1": D.dimensionless, "μ_B": D.dimensionless };
  for (const r of REGISTRY) {
    if (!r.quantity) continue;
    const expected = unitDims[r.quantity.unit];
    assert.ok(expected, `unknown unit ${r.quantity.unit} in ${r.id}`);
    assert.ok(sameDim(r.quantity.dimension, expected as typeof D.temperature), r.id);
  }
});

test("software version matches package.json", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
  assert.equal(LAB_VERSION, pkg.version);
});
