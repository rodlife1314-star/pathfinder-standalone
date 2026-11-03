import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../src/integration/rigid-body.ts";
import { bodyAxisInWorld, dipoleEnergySeries, polarAngle, unwrappedAzimuth } from "../src/integration/observables.ts";
import { fromAxisAngle, IDENTITY } from "../src/physics/quaternion.ts";
import { fastTopEpsilon, fastTopPrecessionRate } from "../src/physics/magnetic.ts";
import { assessMagneticConservation, validateMagneticSimulationInputs } from "../src/crucible/validators.ts";

const raw = (o: Partial<Record<string, unknown>> = {}) => ({
  inertia: ["0.02", "0.02", "0.04"] as const, omega: ["0", "0", "20"] as const, duration: "10", dt: "0.002",
  momentBody: ["0", "0", "1"] as const, fieldWorld: ["0", "0", "0.1"] as const, tilt: "0.5", ...o,
}) as Parameters<typeof validateMagneticSimulationInputs>[0];

test("fast-top formulas: sign, units-by-hand, ε", () => {
  // m=1 A·m², B=0.1 T, I3=0.04 kg·m², ω3=20 rad/s → −0.1/0.8 = −0.125 rad/s
  assert.equal(fastTopPrecessionRate(1, 0.1, 0.04, 20), -0.125);
  assert.ok(Math.abs(fastTopEpsilon(0.02, 0.04, 1, 0.1, 20) - 0.003125) < 1e-15);
});

test("azimuth unwrapping counts full turns and handles any 'about' axis", () => {
  const vs = Array.from({ length: 401 }, (_, i) => { const a = (i / 400) * 4 * Math.PI; return [Math.cos(a), Math.sin(a), 0.3] as const; });
  assert.ok(Math.abs(unwrappedAzimuth(vs, [0, 0, 1]).at(-1)! - 4 * Math.PI) < 1e-12);
  assert.ok(Math.abs(unwrappedAzimuth(vs, [0, 0, -1]).at(-1)! + 4 * Math.PI) < 1e-12, "reversed axis reverses sense");
  assert.ok(Math.abs(polarAngle([[0, 0, 1], [1, 0, 0]], [0, 0, 1])[1]! - Math.PI / 2) < 1e-15);
});

test("dipole energy series: aligned m has U = −|m||B|", () => {
  const rec = simulate({ inertia: [1, 1, 2], magneticMomentBody: [0, 0, 2], fieldWorld: [0, 0, 0.5] }, { q: IDENTITY, omega: [0, 0, 0] }, { dt: 0.01, steps: 2, sampleEvery: 1, renormalise: true });
  assert.deepEqual(dipoleEnergySeries(rec.samples, [0, 0, 2], [0, 0, 0.5]), [-1, -1, -1]);
});

test("magnetic validator accepts a sane run and rejects bad m, B, tilt, Δt", () => {
  assert.equal(validateMagneticSimulationInputs(raw()).status, "PASSED");
  assert.equal(validateMagneticSimulationInputs(raw({ momentBody: ["x", "0", "1"] })).status, "FAILED");
  assert.equal(validateMagneticSimulationInputs(raw({ fieldWorld: ["0", "0", "Infinity"] })).status, "FAILED");
  assert.equal(validateMagneticSimulationInputs(raw({ tilt: "4" })).status, "FAILED");
  // Strong field: √(|m||B|/I_min) = √(1000/0.02) ≈ 224 rad/s → 0.45 rad/step at Δt 2 ms → warn; 5 ms → refuse
  assert.ok(validateMagneticSimulationInputs(raw({ fieldWorld: ["0", "0", "1000"] })).warnings.some((w) => /50 T/.test(w)));
  assert.equal(validateMagneticSimulationInputs(raw({ fieldWorld: ["0", "0", "1000"], dt: "0.005" })).status, "FAILED");
  assert.ok(validateMagneticSimulationInputs(raw({ fieldWorld: ["0", "0", "0"] })).warnings.some((w) => /torque-free/.test(w)));
});

test("magnetic conservation: E and L·B̂ pass; |L| reported as control; coarse run fails", () => {
  const p = { inertia: [0.02, 0.02, 0.04] as const, magneticMomentBody: [0, 0, 1] as const, fieldWorld: [0, 0, 0.1] as const };
  const fine = simulate(p, { q: fromAxisAngle([1, 0, 0], 0.5), omega: [0, 0, 20] }, { dt: 0.002, steps: 5000, sampleEvery: 10, renormalise: true });
  const a = assessMagneticConservation(fine, 1e-6);
  assert.deepEqual(a.map((x) => x.status), ["PASSED", "PASSED", "INCONCLUSIVE"]);
  const coarse = simulate(p, { q: fromAxisAngle([1, 0, 0], 0.5), omega: [0, 0, 20] }, { dt: 0.03, steps: 300, sampleEvery: 1, renormalise: true });
  assert.ok(assessMagneticConservation(coarse, 1e-6).some((x) => x.status === "FAILED"));
});

test("simulated precession direction matches the sign of the analytic rate", () => {
  const rec = simulate({ inertia: [0.02, 0.02, 0.04], magneticMomentBody: [0, 0, 1], fieldWorld: [0, 0, 0.1] },
    { q: fromAxisAngle([1, 0, 0], 0.5), omega: [0, 0, 20] }, { dt: 0.002, steps: 10000, sampleEvery: 10, renormalise: true });
  const phi = unwrappedAzimuth(bodyAxisInWorld(rec.samples, [0, 0, 1]), [0, 0, 1]);
  assert.ok(phi.at(-1)! < 0 && fastTopPrecessionRate(1, 0.1, 0.04, 20) < 0);
});

test("magnetic conservation from rest (|L₀| = 0) gives finite, meaningful errors", () => {
  const rec = simulate({ inertia: [0.02, 0.02, 0.04], magneticMomentBody: [0, 0, 1], fieldWorld: [0, 0, 0.1] },
    { q: fromAxisAngle([1, 0, 0], 0.5), omega: [0, 0, 0] }, { dt: 0.002, steps: 5000, sampleEvery: 10, renormalise: true });
  const a = assessMagneticConservation(rec, 1e-6);
  assert.equal(a[0]!.status, "PASSED");
  assert.equal(a[1]!.status, "PASSED");
  assert.ok(Number.isFinite(a[1]!.maxRelativeError!) && a[1]!.maxRelativeError! < 1e-6);
  assert.equal(a[2]!.maxRelativeError, null);
  assert.match(a[2]!.note, /undefined/);
});
