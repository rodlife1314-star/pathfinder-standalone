import { test } from "node:test";
import assert from "node:assert/strict";
import { eulerAngularAcceleration, eulerWorking } from "../src/physics/euler.ts";

test("Operator's sign convention equals the engine form", () => {
  const I = [0.02, 0.03, 0.04] as const, w = [0.5, -3, 1.2] as const, tau = [0.01, 0.002, -0.03] as const;
  const a = eulerAngularAcceleration(I, w, tau);
  eulerWorking(I, w, tau).axes.forEach((ax, i) => assert.ok(Math.abs(ax.angularAcceleration - a[i]!) < 1e-15));
});

test("intermediate values for a hand-worked case", () => {
  // I = (1,2,3), ω = (1,1,1), τ = (0.5,0,0)
  const W = eulerWorking([1, 2, 3], [1, 1, 1], [0.5, 0, 0]);
  const [x, y, z] = W.axes;
  assert.deepEqual([x.inertiaDifference, x.omegaProduct, x.gyroscopicTerm, x.netEffectiveTorque, x.angularAcceleration], [1, 1, 1, -0.5, -0.5]);
  assert.deepEqual([y.inertiaDifference, y.gyroscopicTerm, y.angularAcceleration], [-2, -2, 1]);
  assert.deepEqual([z.inertiaDifference, z.gyroscopicTerm], [1, 1]); // (I₂ − I₁) = 2 − 1
  assert.ok(Math.abs(z.angularAcceleration - -1 / 3) < 1e-15); // (0 − 1)/3
  assert.deepEqual(W.angularMomentumBody, [1, 2, 3]);
  assert.equal(W.kineticEnergy, 3);
  assert.ok(Math.abs(W.angularMomentumMagnitude - Math.sqrt(14)) < 1e-15);
});
