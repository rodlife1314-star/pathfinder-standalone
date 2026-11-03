import { test } from "node:test";
import assert from "node:assert/strict";
import { rk4Step } from "../src/sim/rk4.ts";
import { simulate } from "../src/sim/rigid-body.ts";
import { IDENTITY } from "../src/math/quaternion.ts";

test("RK4 on y' = y reproduces e to O(h⁴)", () => {
  let y = [1];
  const h = 0.01;
  for (let i = 0; i < 100; i++) y = rk4Step((_t, v) => [v[0]!], i * h, y, h);
  assert.ok(Math.abs(y[0]! - Math.E) < 1e-9);
});

test("simulate refuses inadmissible inputs instead of producing numbers", () => {
  const p = { inertia: [1, 1, 3] as const, magneticMomentBody: [0, 0, 0] as const, fieldWorld: [0, 0, 0] as const };
  assert.throws(() => simulate(p, { q: IDENTITY, omega: [0, 0, 1] }, { dt: 0.01, steps: 10, sampleEvery: 1, renormalise: true }), /Triangle inequality/);
});

test("simulation record carries provenance metadata", () => {
  const rec = simulate(
    { inertia: [1, 2, 3], magneticMomentBody: [0, 0, 0], fieldWorld: [0, 0, 0] },
    { q: IDENTITY, omega: [0, 0, 1] },
    { dt: 0.01, steps: 10, sampleEvery: 5, renormalise: true },
  );
  assert.equal(rec.schema, "lab067.simulation/0.1.0");
  assert.equal(rec.integrator, "RK4");
  assert.ok(rec.assumptions.length > 0);
  assert.deepEqual(rec.samples.map((s) => s.t), [0, 0.05, 0.1]);
});
