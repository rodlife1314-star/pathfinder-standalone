import { test } from "node:test";
import assert from "node:assert/strict";
import { D, divDim, formatDim, mulDim, powDim, sameDim } from "../src/units/dimension.ts";

test("tesla × A·m² = N·m (magnetic torque)", () => {
  assert.ok(sameDim(mulDim(D.magneticMoment, D.magneticFluxDensity), D.torque));
});
test("I·ω = angular momentum, not torque", () => {
  const Iw = mulDim(D.momentOfInertia, D.angularVelocity);
  assert.ok(sameDim(Iw, D.angularMomentum));
  assert.ok(!sameDim(Iw, D.torque));
});
test("torque / inertia = angular acceleration; pow and format", () => {
  assert.ok(sameDim(divDim(D.torque, D.momentOfInertia), D.angularAcceleration));
  assert.ok(sameDim(powDim(D.angularVelocity, 2), D.angularAcceleration));
  assert.equal(formatDim(D.torque), "kg·m^2·s^-2");
  assert.equal(formatDim(D.dimensionless), "1 (dimensionless)");
});
test("documented limitation: torque and energy are dimensionally identical", () => {
  assert.ok(sameDim(D.torque, D.energy));
});
