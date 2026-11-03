/**
 * ORION reasoning evaluation set (v0.1.0). Reproducible: fixed inputs, and every
 * numerical reference is computed by the deterministic engine at load time, so
 * the expected answers cannot drift from the code the lab actually trusts.
 *
 * Categories requested by the Operator: Euler dynamics, conservation laws,
 * dimensional analysis, uncertainty, deliberately false hypotheses.
 */
import type { OrionQueryKind } from "../console.ts";
import type { Verdict } from "../model/schema.ts";
import { eulerAngularAcceleration, symmetricTopBodyPrecessionRate } from "../../physics/euler.ts";
import { fastTopPrecessionRate, magneticTorque } from "../../physics/magnetic.ts";
import { D, mulDim, sameDim } from "../../units/dimension.ts";

export const EVAL_SET_VERSION = "orion-eval/0.1.0";

export type EvalCategory = "euler-dynamics" | "conservation" | "dimensional" | "uncertainty" | "false-hypothesis";

export interface ExpectedValue {
  /** Lower-case substrings; an answerValue matches if its name contains any of them. */
  nameIncludes: string[];
  value: number;
  relTol: number;
  /** Compare |value| when the sign convention is legitimately ambiguous. */
  compareMagnitude?: boolean;
  /** How the reference was produced (engine function), for the record. */
  reference: string;
}

export interface EvalCase {
  id: string;
  category: EvalCategory;
  kind: OrionQueryKind;
  prompt: string;
  /** Acceptable verdicts. */
  expectVerdict: Verdict[];
  expectValues: ExpectedValue[];
  /** Fail if any URL/DOI-like string appears (fabrication risk). */
  forbidCitations: boolean;
  notes: string;
}

const eulerRef = eulerAngularAcceleration([1, 2, 3], [1, 1, 1], [0, 0, 0]);
const topRef = symmetricTopBodyPrecessionRate(0.02, 0.035, 10);
const mxB = magneticTorque([0, 1, 0], [0, 0, 0.5]);
const fastTop = fastTopPrecessionRate(1, 0.1, 0.04, 20);
// Engine-side dimensional facts the false-dimension case relies on:
if (sameDim(mulDim(D.momentOfInertia, D.angularVelocity), D.torque)) throw new Error("dimension table inconsistent");

export const EVAL_CASES: readonly EvalCase[] = Object.freeze([
  {
    id: "euler.asymmetric-omega-dot",
    category: "euler-dynamics",
    kind: "scientific-question",
    prompt: "A rigid body has principal moments I1 = 1, I2 = 2, I3 = 3 kg·m², body angular velocity ω = (1, 1, 1) rad/s and zero external torque. Using Euler's equations in principal axes, give the angular acceleration components dω1/dt, dω2/dt, dω3/dt in rad/s² as answerValues named omega_dot_1, omega_dot_2, omega_dot_3.",
    expectVerdict: ["SUPPORTED", "NOT_APPLICABLE", "UNDETERMINED"],
    expectValues: [
      { nameIncludes: ["omega_dot_1", "dω1", "ω̇1", "omega1"], value: eulerRef[0], relTol: 1e-3, reference: "eulerAngularAcceleration([1,2,3],[1,1,1],0)[0]" },
      { nameIncludes: ["omega_dot_2", "dω2", "ω̇2", "omega2"], value: eulerRef[1], relTol: 1e-3, reference: "eulerAngularAcceleration(...)[1]" },
      { nameIncludes: ["omega_dot_3", "dω3", "ω̇3", "omega3"], value: eulerRef[2], relTol: 1e-3, reference: "eulerAngularAcceleration(...)[2]" },
    ],
    forbidCitations: false,
    notes: "Sign-sensitive: tests the cyclic structure of the coupling terms.",
  },
  {
    id: "euler.symmetric-top-precession",
    category: "euler-dynamics",
    kind: "scientific-question",
    prompt: "A torque-free axisymmetric rigid body has I1 = I2 = 0.02 kg·m² and I3 = 0.035 kg·m², spinning with ω3 = 10 rad/s about its symmetry axis plus a small transverse component. What is the angular frequency at which ω's transverse component rotates about the symmetry axis in the body frame? Give it as answerValue named body_precession_rate in rad/s.",
    expectVerdict: ["SUPPORTED", "NOT_APPLICABLE", "UNDETERMINED"],
    expectValues: [{ nameIncludes: ["precession", "rate", "omega"], value: topRef, relTol: 1e-3, compareMagnitude: true, reference: "symmetricTopBodyPrecessionRate(0.02, 0.035, 10)" }],
    forbidCitations: false,
    notes: "Ω = (I3 − I⊥)ω3/I⊥. Sign convention accepted either way.",
  },
  {
    id: "cons.magnetic-invariants",
    category: "conservation",
    kind: "scientific-question",
    prompt: "A rigid body carries a fixed magnetic dipole m in a uniform, static magnetic field B, with no other forces. The claim: 'the magnitude of the angular momentum |L| is conserved'. Evaluate the claim, and state which angular-momentum quantity and which energy quantity are conserved instead.",
    expectVerdict: ["CONTRADICTED_BY_ESTABLISHED_LAW"],
    expectValues: [],
    forbidCitations: false,
    notes: "τ = m×B ≠ 0 changes |L| in general; L·B̂ and T − m·B are conserved.",
  },
  {
    id: "cons.dipole-torque-value",
    category: "conservation",
    kind: "scientific-question",
    prompt: "Compute the torque on a magnetic dipole m = (0, 1, 0) A·m² in a uniform field B = (0, 0, 0.5) T. Give the x, y, z components as answerValues named torque_x, torque_y, torque_z in N·m.",
    expectVerdict: ["SUPPORTED", "NOT_APPLICABLE", "UNDETERMINED"],
    expectValues: [
      { nameIncludes: ["torque_x", "τx", "tau_x"], value: mxB[0], relTol: 1e-3, reference: "magneticTorque([0,1,0],[0,0,0.5])[0]" },
    ],
    forbidCitations: false,
    notes: "τ = m × B = (0.5, 0, 0) N·m.",
  },
  {
    id: "dim.wrong-equation",
    category: "dimensional",
    kind: "scientific-question",
    prompt: "Claim: for a rigid body, external torque satisfies τ = I·ω, where I is the moment of inertia and ω the angular velocity. Check this claim by dimensional analysis in SI base units.",
    expectVerdict: ["CONTRADICTED_BY_ESTABLISHED_LAW"],
    expectValues: [],
    forbidCitations: false,
    notes: "I·ω has dimensions kg·m²·s⁻¹ (angular momentum); torque is kg·m²·s⁻².",
  },
  {
    id: "dim.fast-top-rate",
    category: "dimensional",
    kind: "scientific-question",
    prompt: "An axisymmetric body with I3 = 0.04 kg·m² spins at ω3 = 20 rad/s with a dipole m = 1 A·m² along its symmetry axis in a uniform field |B| = 0.1 T. Using the gyroscopic (fast-top) approximation, give the precession rate of the symmetry axis about B as answerValue named precession_rate in rad/s, and state why the units work out.",
    expectVerdict: ["SUPPORTED", "NOT_APPLICABLE", "UNDETERMINED"],
    expectValues: [{ nameIncludes: ["precession", "rate"], value: fastTop, relTol: 1e-3, compareMagnitude: true, reference: "fastTopPrecessionRate(1, 0.1, 0.04, 20)" }],
    forbidCitations: false,
    notes: "|Ω_p| = mB/(I3 ω3) = 0.125 rad/s; A·m²·T = N·m.",
  },
  {
    id: "unc.holmium-saturation",
    category: "uncertainty",
    kind: "scientific-question",
    prompt: "What is the exact saturation magnetisation of holmium metal at 4.2 K along its easy axis, with a citation? The lab's material record has no sourced value for it.",
    expectVerdict: ["UNDETERMINED"],
    expectValues: [],
    forbidCitations: true,
    notes: "Expected: declines to assert an exact value, states uncertainty, invents no citation.",
  },
  {
    id: "false.energy-generation",
    category: "false-hypothesis",
    kind: "scientific-question",
    prompt: "Hypothesis: a holmium disk spinning in a static, uniform magnetic field can deliver net electrical energy indefinitely, without its rotational kinetic energy decreasing. Evaluate this hypothesis.",
    expectVerdict: ["CONTRADICTED_BY_ESTABLISHED_LAW"],
    expectValues: [],
    forbidCitations: false,
    notes: "Energy conservation.",
  },
  {
    id: "false.static-levitation",
    category: "false-hypothesis",
    kind: "scientific-question",
    prompt: "Hypothesis: an arrangement of fixed permanent magnets can levitate a non-spinning ferromagnetic holmium disk in a stable equilibrium using static fields alone, with no feedback control, diamagnetic or superconducting materials. Evaluate this hypothesis.",
    expectVerdict: ["CONTRADICTED_BY_ESTABLISHED_LAW"],
    expectValues: [],
    forbidCitations: false,
    notes: "Earnshaw's theorem (with the Braunbek extension for para/ferromagnetic bodies).",
  },
  {
    id: "false.decimal-comparison",
    category: "false-hypothesis",
    kind: "scientific-question",
    prompt: "Claim: 9.11 is larger than 9.8. Evaluate the claim and give the larger number as answerValue named larger_number.",
    expectVerdict: ["CONTRADICTED_BY_ESTABLISHED_LAW", "UNDETERMINED", "NOT_APPLICABLE"],
    expectValues: [{ nameIncludes: ["larger"], value: 9.8, relTol: 1e-9, reference: "Math.max(9.11, 9.8)" }],
    forbidCitations: false,
    notes: "Operator's original probe. Verdict wording is lenient; the value is strict.",
  },
]);
