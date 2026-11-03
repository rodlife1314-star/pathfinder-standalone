import { test } from "node:test";
import assert from "node:assert/strict";
import { cross, dot, norm, type Vec3 } from "../src/math/vec3.ts";
import { fromAxisAngle, qmul, qnorm, rotate, rotateInverse } from "../src/math/quaternion.ts";
import { checkPrincipalInertia, solidCuboid, solidCylinder, solidSphere } from "../src/math/inertia.ts";
import {
  angularMomentumBody, eulerAngularAcceleration, gyroscopicTerm, rotationalKineticEnergy,
  symmetricTopBodyPrecessionRate, symmetricTopOmega,
} from "../src/math/euler.ts";
import { dipolePotentialEnergy, magneticTorque } from "../src/math/magnetic.ts";
import { hund4f } from "../src/math/hund.ts";

const close = (a: number, b: number, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const closeV = (a: Vec3, b: Vec3, tol = 1e-12) => a.forEach((x, i) => close(x, b[i]!, tol));

test("cross product: basis, anticommutativity, orthogonality", () => {
  assert.deepEqual(cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  const a: Vec3 = [1.5, -2, 0.3], b: Vec3 = [0.2, 4, -1];
  closeV(cross(a, b), cross(b, a).map((x) => -x) as unknown as Vec3);
  close(dot(cross(a, b), a), 0);
  close(dot(cross(a, b), b), 0);
});

test("quaternion: 90° about z maps x→y; inverse undoes; product stays unit", () => {
  const q = fromAxisAngle([0, 0, 1], Math.PI / 2);
  closeV(rotate(q, [1, 0, 0]), [0, 1, 0]);
  closeV(rotateInverse(q, rotate(q, [0.3, -1, 2])), [0.3, -1, 2]);
  close(qnorm(qmul(q, fromAxisAngle([1, 1, 0], 0.7))), 1);
  close(norm(rotate(fromAxisAngle([1, 2, 3], 1.1), [3, 4, 0])), 5);
});

test("inertia formulas", () => {
  closeV(solidSphere(5, 0.1), [0.02, 0.02, 0.02]);
  // m=1, r=0.05, h=0.2: Ix = (3·0.0025 + 0.04)/12 = 0.0475/12, Iz = 0.00125
  closeV(solidCylinder(1, 0.05, 0.2), [0.0475 / 12, 0.0475 / 12, 0.00125]);
  closeV(solidCuboid(12, 1, 2, 3), [13, 10, 5]);
  assert.throws(() => solidSphere(-1, 1), RangeError);
});

test("inertia admissibility rejects triangle-inequality counterexample", () => {
  assert.ok(checkPrincipalInertia([1, 2, 3]).valid); // 1 + 2 = 3, limiting case (flat lamina) — admissible
  assert.ok(!checkPrincipalInertia([1, 1, 3]).valid);
  assert.ok(!checkPrincipalInertia([0, 1, 1]).valid);
  assert.ok(!checkPrincipalInertia([NaN, 1, 1]).valid);
});

test("Euler equations: hand-worked example", () => {
  // I = (1,2,3), ω = (1,1,1), τ = 0:  ω̇1 = (2-3)/1 = -1, ω̇2 = (3-1)/2 = 1, ω̇3 = (1-2)/3 = -1/3
  closeV(eulerAngularAcceleration([1, 2, 3], [1, 1, 1], [0, 0, 0]), [-1, 1, -1 / 3]);
  // Equivalent vector form: I ω̇ = τ − ω × (Iω)
  const I: Vec3 = [0.02, 0.03, 0.04], w: Vec3 = [0.5, -3, 1.2], tau: Vec3 = [0.01, 0.002, -0.03];
  const wd = eulerAngularAcceleration(I, w, tau);
  const g = gyroscopicTerm(I, w);
  closeV([I[0] * wd[0], I[1] * wd[1], I[2] * wd[2]], [tau[0] - g[0], tau[1] - g[1], tau[2] - g[2]]);
});

test("spin about a principal axis is a steady state", () => {
  closeV(eulerAngularAcceleration([1, 2, 3], [0, 7, 0], [0, 0, 0]), [0, 0, 0]);
});

test("energy and angular momentum", () => {
  close(rotationalKineticEnergy([1, 2, 3], [1, 1, 1]), 3);
  closeV(angularMomentumBody([1, 2, 3], [1, 1, 1]), [1, 2, 3]);
});

test("symmetric top analytic solution satisfies Euler's equations", () => {
  const Ip = 0.02, I3 = 0.035, w0: Vec3 = [0.4, 0.1, 10];
  close(symmetricTopBodyPrecessionRate(Ip, I3, 10), 7.5);
  const t = 0.37, h = 1e-6;
  const a = symmetricTopOmega(Ip, I3, w0, t + h), b = symmetricTopOmega(Ip, I3, w0, t - h);
  const numeric: Vec3 = [(a[0] - b[0]) / (2 * h), (a[1] - b[1]) / (2 * h), (a[2] - b[2]) / (2 * h)];
  closeV(numeric, eulerAngularAcceleration([Ip, Ip, I3], symmetricTopOmega(Ip, I3, w0, t), [0, 0, 0]), 1e-6);
});

test("magnetic torque: m=(0,1,0) A·m², B=(0,0,0.5) T → τ=(0.5,0,0) N·m; U = −m·B", () => {
  closeV(magneticTorque([0, 1, 0], [0, 0, 0.5]), [0.5, 0, 0]);
  close(dipolePotentialEnergy([0, 0, 2], [0, 0, 0.5]), -1);
  closeV(magneticTorque([0, 0, 2], [0, 0, 0.5]), [0, 0, 0]); // aligned ⇒ no torque
});

test("Hund's rules: Ho³⁺ 4f¹⁰ → ⁵I₈, g_J = 5/4", () => {
  const h = hund4f(10);
  assert.equal(h.S, 2); assert.equal(h.L, 6); assert.equal(h.J, 8);
  assert.equal(h.termSymbol, "5I8");
  close(h.gJ, 1.25);
  close(h.muEffInBohrMagnetons, 1.25 * Math.sqrt(72));
  close(h.muSatInBohrMagnetons, 10);
});

test("Hund's rules cross-checks on other ions (independent textbook cases)", () => {
  const ce = hund4f(1); // Ce³⁺: ²F₅/₂, g = 6/7
  assert.equal(ce.termSymbol, "2F5/2"); close(ce.gJ, 6 / 7);
  const gd = hund4f(7); // Gd³⁺: ⁸S₇/₂, g = 2
  assert.equal(gd.termSymbol, "8S7/2"); close(gd.gJ, 2);
  const dy = hund4f(9); // Dy³⁺: ⁶H₁₅/₂, g = 4/3
  assert.equal(dy.termSymbol, "6H15/2"); close(dy.gJ, 4 / 3);
  assert.throws(() => hund4f(0), RangeError);
});
