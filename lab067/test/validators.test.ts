import { test } from "node:test";
import assert from "node:assert/strict";
import { assessTorqueFreeConservation, parseNumericField, validateEulerInputs, validateSimulationInputs } from "../src/crucible/validators.ts";
import { simulate } from "../src/integration/rigid-body.ts";
import { IDENTITY } from "../src/physics/quaternion.ts";

test("strict numeric parsing", () => {
  for (const bad of ["", " ", "abc", "0x10", "Infinity", "-Infinity", "NaN", "1e400", "1,5", "1.2.3", "--1"]) {
    assert.equal(parseNumericField(bad, "x").ok, false, JSON.stringify(bad));
  }
  for (const [s, v] of [["1", 1], [" -2.5 ", -2.5], ["3e-4", 3e-4], [".5", 0.5], ["+7E2", 700], ["0", 0]] as const) {
    assert.deepEqual(parseNumericField(s, "x"), { ok: true, value: v });
  }
});

const Z = ["0", "0", "0"] as const;

test("Euler validator rejects nonphysical inertia and reports every error", () => {
  const r = validateEulerInputs({ inertia: ["1", "1", "3"], omega: ["a", "0", "0"], torque: Z });
  assert.equal(r.status, "FAILED");
  assert.equal(r.value, null);
  assert.ok(r.errors.some((e) => /ω1/.test(e)));
  assert.ok(r.errors.some((e) => /Triangle/.test(e)));
  assert.equal(validateEulerInputs({ inertia: ["0", "1", "1"], omega: Z, torque: Z }).status, "FAILED");
});

test("Euler validator accepts valid input and warns on planar limit", () => {
  const r = validateEulerInputs({ inertia: ["1", "2", "3"], omega: ["1", "1", "1"], torque: Z });
  assert.equal(r.status, "PASSED");
  assert.deepEqual(r.value?.inertia, [1, 2, 3]);
  assert.ok(r.warnings.some((w) => /flat/.test(w)));
});

test("simulation validator: step count, cap, coarse Δt", () => {
  const base = { inertia: ["1", "2", "2.5"] as const, omega: ["0", "0", "1"] as const };
  const ok = validateSimulationInputs({ ...base, duration: "10", dt: "0.01" });
  assert.equal(ok.status, "PASSED");
  assert.equal(ok.value?.steps, 1000);
  assert.equal(validateSimulationInputs({ ...base, duration: "1e4", dt: "0.001" }).status, "FAILED"); // 10M steps
  assert.equal(validateSimulationInputs({ ...base, duration: "10", dt: "2" }).status, "FAILED"); // 2.5 rad/step
  assert.ok(validateSimulationInputs({ ...base, duration: "10", dt: "0.1" }).warnings.some((w) => /coarse/.test(w)));
});

test("conservation assessment passes a good run and fails a deliberately coarse one", () => {
  const p = { inertia: [1, 2, 2.5] as const, magneticMomentBody: [0, 0, 0] as const, fieldWorld: [0, 0, 0] as const };
  const good = simulate(p, { q: IDENTITY, omega: [0.3, 1, 0.5] }, { dt: 0.01, steps: 1000, sampleEvery: 10, renormalise: true });
  assert.ok(assessTorqueFreeConservation(good, 1e-6).every((a) => a.status === "PASSED"));
  const coarse = simulate(p, { q: IDENTITY, omega: [0.3, 3, 0.5] }, { dt: 0.4, steps: 200, sampleEvery: 1, renormalise: true });
  assert.ok(assessTorqueFreeConservation(coarse, 1e-6).some((a) => a.status === "FAILED"));
});

test("conservation assessment is INCONCLUSIVE when torque acts", () => {
  const p = { inertia: [1, 2, 2.5] as const, magneticMomentBody: [0, 0, 1] as const, fieldWorld: [0.1, 0, 0] as const };
  const rec = simulate(p, { q: IDENTITY, omega: [0, 0, 1] }, { dt: 0.01, steps: 10, sampleEvery: 1, renormalise: true });
  assert.ok(assessTorqueFreeConservation(rec).every((a) => a.status === "INCONCLUSIVE"));
});
