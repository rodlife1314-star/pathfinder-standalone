/**
 * Scientific reference registry — Phase 001 seed.
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
import { hund4f } from "../math/hund.ts";
import type { ReferenceRecord } from "./types.ts";

const ho3 = hund4f(10);

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

  // ── Element 67: identity ──────────────────────────────────────────────────
  {
    schema: SCHEMA.reference,
    id: "ho.atomic-number",
    title: "Holmium atomic number",
    evidenceClass: "EMPIRICAL_MEASUREMENT",
    origin: "AI_RECALL",
    statement: "Holmium (symbol Ho) is element 67: 67 protons per nucleus.",
    quantity: { value: 67, unit: "1", dimension: D.dimensionless, uncertainty: 0 },
    citation: { status: "IDENTIFIED_UNCHECKED", source: "IUPAC Periodic Table of the Elements" },
    conditions: [],
    limitations: [],
  },

  // ── Element 67: derived (free-ion model, computed by src/math/hund.ts) ────
  {
    schema: SCHEMA.reference,
    id: "ho3.ground-term.hund",
    title: "Ho³⁺ (4f¹⁰) ground term — Hund's rules",
    evidenceClass: "MATHEMATICAL_DERIVATION",
    origin: "COMPUTED",
    statement: `Hund's rules give S=${ho3.S}, L=${ho3.L}, J=${ho3.J}: term ${ho3.termSymbol}, g_J=${ho3.gJ}.`,
    quantity: null,
    citation: { status: "NONE", source: null },
    conditions: ["Free ion", "LS (Russell–Saunders) coupling", "Assumes trivalent ion with 4f¹⁰ configuration"],
    limitations: ["Derivation within a model, not a measurement", "Crystal field and exchange in the metal ignored"],
  },
  {
    schema: SCHEMA.reference,
    id: "ho3.mu-eff.hund",
    title: "Ho³⁺ free-ion effective moment (derived)",
    evidenceClass: "MATHEMATICAL_DERIVATION",
    origin: "COMPUTED",
    statement: "μ_eff = g_J √(J(J+1)) μ_B from the Hund's-rules ground term.",
    quantity: { value: ho3.muEffInBohrMagnetons, unit: "μ_B", dimension: D.dimensionless, uncertainty: null },
    citation: { status: "NONE", source: null },
    conditions: ["Paramagnetic regime", "Free-ion approximation"],
    limitations: ["Must be compared with a cited measurement before treating as physical"],
  },

  // ── Element 67: empirical, recalled without citation — NOT RELIABLE ───────
  {
    schema: SCHEMA.reference,
    id: "ho.neel-temperature",
    title: "Holmium metal: helical antiferromagnetic ordering temperature",
    evidenceClass: "EMPIRICAL_MEASUREMENT",
    origin: "AI_RECALL",
    statement: "Holmium metal orders magnetically (helical) below approximately 132 K.",
    quantity: { value: 132, unit: "K", dimension: D.temperature, uncertainty: null },
    citation: { status: "NONE", source: null },
    conditions: ["Bulk single-crystal / polycrystal, zero applied field"],
    limitations: ["Recalled from training memory — needs primary literature citation", "Uncertainty unknown"],
  },
  {
    schema: SCHEMA.reference,
    id: "ho.low-temperature-transition",
    title: "Holmium metal: low-temperature (conical/ferromagnetic) transition",
    evidenceClass: "EMPIRICAL_MEASUREMENT",
    origin: "AI_RECALL",
    statement: "Holmium metal enters a conical ferromagnetic phase below approximately 20 K.",
    quantity: { value: 20, unit: "K", dimension: D.temperature, uncertainty: null },
    citation: { status: "NONE", source: null },
    conditions: ["Bulk, zero applied field"],
    limitations: ["Recalled from training memory — needs primary literature citation", "Uncertainty unknown"],
  },

  // ── Cryogenic context ─────────────────────────────────────────────────────
  {
    schema: SCHEMA.reference,
    id: "cryo.ln2-boiling-point",
    title: "Normal boiling point of liquid nitrogen",
    evidenceClass: "EMPIRICAL_MEASUREMENT",
    origin: "AI_RECALL",
    statement: "N₂ boils at approximately 77.4 K at 101.325 kPa.",
    quantity: { value: 77.36, unit: "K", dimension: D.temperature, uncertainty: null },
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
    statement: "⁴He boils at approximately 4.2 K at 101.325 kPa.",
    quantity: { value: 4.22, unit: "K", dimension: D.temperature, uncertainty: null },
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
