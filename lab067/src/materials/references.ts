/**
 * Scientific reference registry — laws, constants and context (Phase 001 seed).
 * Holmium material properties live in ./holmium.ts.
 *
 * INTEGRITY NOTICE: entries with origin "AI_RECALL" were typed by the
 * engineering assistant from training memory. They are NOT verified. Where a
 * real source is believed to contain the value, it is named with status
 * IDENTIFIED_UNCHECKED; otherwise status is NONE. No URL, DOI or page number
 * has been invented. Only the Operator may promote a citation to
 * OPERATOR_VERIFIED, by editing this file in a reviewed commit.
 */
import { SCHEMA } from "../contracts/evidence.ts";
import { D } from "../units/dimension.ts";
import type { ReferenceRecord } from "./types.ts";

const records: ReferenceRecord[] = [
  // ── Established laws (classical mechanics / electromagnetism) ──────────────
  {
    schema: SCHEMA.reference,
    id: "law.euler-rigid-body",
    title: "Euler's equations for rigid-body rotation",
    evidenceClass: "ESTABLISHED_LAW",
    origin: "AI_RECALL",
    statement: "In principal body axes: I1ω̇1 = (I2−I3)ω2ω3 + τ1 (and cyclic permutations).",
    quantity: null,
    citation: { status: "IDENTIFIED_UNCHECKED", source: "Standard classical-mechanics texts (e.g. Goldstein, Classical Mechanics; Landau & Lifshitz, Mechanics)" },
    conditions: ["Rigid body", "Principal axes through centre of mass", "World frame inertial"],
    limitations: ["No deformation, fluid fill, or internal moving parts", "Non-relativistic"],
  },
  {
    schema: SCHEMA.reference,
    id: "law.dipole-torque",
    title: "Torque and energy of a magnetic dipole in a uniform field",
    evidenceClass: "ESTABLISHED_LAW",
    origin: "AI_RECALL",
    statement: "τ = m × B and U = −m·B for a point dipole m in uniform B.",
    quantity: null,
    citation: { status: "IDENTIFIED_UNCHECKED", source: "Standard electromagnetism texts (e.g. Griffiths, Introduction to Electrodynamics; Jackson, Classical Electrodynamics)" },
    conditions: ["Uniform field over the body", "Fixed (non-induced) moment"],
    limitations: ["Field gradients produce net force — not modelled", "Ignores hysteresis and induced magnetisation"],
  },

  // ── Physical constants ────────────────────────────────────────────────────
  {
    schema: SCHEMA.reference,
    id: "const.bohr-magneton",
    title: "Bohr magneton μ_B",
    evidenceClass: "EMPIRICAL_MEASUREMENT",
    origin: "AI_RECALL",
    statement: "μ_B = eħ/(2m_e).",
    quantity: { value: 9.2740100783e-24, unit: "J/T", dimension: D.magneticMoment, uncertainty: 2.8e-33 },
    citation: { status: "IDENTIFIED_UNCHECKED", source: "CODATA 2018 recommended values (NIST). Value recalled, not checked; CODATA 2022 may differ in final digits." },
    conditions: [],
    limitations: ["Check against the current CODATA release before use"],
  },

  // ── Cryogenic context ─────────────────────────────────────────────────────
  {
    schema: SCHEMA.reference,
    id: "cryo.ln2-boiling-point",
    title: "Normal boiling point of liquid nitrogen",
    evidenceClass: "EMPIRICAL_MEASUREMENT",
    origin: "AI_RECALL",
    statement: "PLACEHOLDER — value to be sourced (e.g. NIST thermophysical data). Assistant recalls ≈ 77 K; unverified, not stored as data.",
    quantity: null,
    citation: { status: "NONE", source: null },
    conditions: ["Pressure 101.325 kPa"],
    limitations: ["Recalled — needs citation (e.g. NIST thermophysical data)"],
  },
  {
    schema: SCHEMA.reference,
    id: "cryo.lhe4-boiling-point",
    title: "Normal boiling point of liquid helium-4",
    evidenceClass: "EMPIRICAL_MEASUREMENT",
    origin: "AI_RECALL",
    statement: "PLACEHOLDER — value to be sourced. Assistant recalls ≈ 4.2 K; unverified, not stored as data.",
    quantity: null,
    citation: { status: "NONE", source: null },
    conditions: ["Pressure 101.325 kPa"],
    limitations: ["Recalled — needs citation (e.g. NIST thermophysical data)"],
  },
];

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/** Read-only registry. Nothing at runtime (incl. ORION) can mutate it. */
export const REGISTRY: readonly ReferenceRecord[] = deepFreeze(records);

export function getReference(id: string): ReferenceRecord | undefined {
  return REGISTRY.find((r) => r.id === id);
}
