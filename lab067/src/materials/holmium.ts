/**
 * Element 67 — holmium. Phase 001 material record.
 *
 * There are ZERO sourced values. Every empirical property is a PLACEHOLDER
 * with a null value; any number the assistant recalls is confined to the
 * `assistantRecall` text and is not data. The Operator fills sourced values
 * via a reviewed code change (the UI can only submit proposals to the ledger).
 */
import { hund4f } from "../physics/hund.ts";
import { MATERIAL_SCHEMA, type MaterialProperty, type MaterialRecord } from "./material-schema.ts";

const ho3 = hund4f(10);

const blank = {
  uncertainty: null, temperatureK: null, measurementConditions: null, referenceUrl: null,
  referenceCitation: null, verifiedBy: null, derivation: null, assistantRecall: null,
} as const;

const placeholder = (p: Pick<MaterialProperty, "id" | "category" | "name" | "unit" | "notes"> & { recall?: string; conditions?: string }): MaterialProperty => ({
  ...blank,
  id: p.id, category: p.category, name: p.name, unit: p.unit, notes: p.notes,
  status: "PLACEHOLDER", evidenceClass: "EMPIRICAL_MEASUREMENT", value: null,
  measurementConditions: p.conditions ?? null,
  assistantRecall: p.recall ?? null,
});

const HUND_DERIVATION = "Hund's rules for 4f¹⁰ (free Ho³⁺ ion, LS coupling) — src/physics/hund.ts";

const properties: MaterialProperty[] = [
  // ── identity ──
  { ...blank, id: "ho.atomic-number", category: "identity", name: "Atomic number Z", status: "DEFINITION", evidenceClass: "ESTABLISHED_LAW",
    value: 67, unit: "1", uncertainty: 0, notes: "Element 67 is holmium by definition. A periodic-table citation is still recommended." },
  { ...blank, id: "ho.symbol", category: "identity", name: "Chemical symbol", status: "DEFINITION", evidenceClass: "ESTABLISHED_LAW",
    value: "Ho", unit: "—", notes: "IUPAC convention." },

  // ── atomic ──
  placeholder({ id: "ho.standard-atomic-weight", category: "atomic", name: "Standard atomic weight", unit: "1 (relative)",
    recall: "≈ 164.930 (single stable isotope ¹⁶⁵Ho). Unverified; check the current IUPAC/CIAAW value.",
    notes: "Needed for molar quantities." }),
  placeholder({ id: "ho.electron-configuration", category: "atomic", name: "Ground-state electron configuration (neutral atom)", unit: "—",
    recall: "[Xe] 4f¹¹ 6s². Unverified.", notes: "Text property." }),
  placeholder({ id: "ho.oxidation-state", category: "atomic", name: "Common oxidation state", unit: "—",
    recall: "+3. Unverified.", notes: "The Hund's-rules derivation below ASSUMES Ho³⁺ (4f¹⁰)." }),

  // ── magnetic: derived within a model ──
  { ...blank, id: "ho3.ground-term", category: "magnetic", name: "Ho³⁺ ground term ²ˢ⁺¹L_J", status: "DERIVED", evidenceClass: "MATHEMATICAL_DERIVATION",
    value: ho3.termSymbol, unit: "—", derivation: `${HUND_DERIVATION}: S=${ho3.S}, L=${ho3.L}, J=${ho3.J}`,
    notes: "Model result. Crystal field in the metal splits this multiplet — not modelled." },
  { ...blank, id: "ho3.lande-g", category: "magnetic", name: "Landé g-factor g_J", status: "DERIVED", evidenceClass: "MATHEMATICAL_DERIVATION",
    value: ho3.gJ, unit: "1", derivation: `${HUND_DERIVATION}: g_J = 1 + [J(J+1)+S(S+1)−L(L+1)]/[2J(J+1)]`,
    notes: "Exact within LS coupling." },
  { ...blank, id: "ho3.mu-eff", category: "magnetic", name: "Free-ion effective moment μ_eff", status: "DERIVED", evidenceClass: "MATHEMATICAL_DERIVATION",
    value: ho3.muEffInBohrMagnetons, unit: "μ_B", derivation: `${HUND_DERIVATION}: μ_eff = g_J √(J(J+1)) μ_B`,
    notes: "Paramagnetic-regime prediction. Compare with a cited Curie–Weiss measurement before relying on it." },
  { ...blank, id: "ho3.mu-sat", category: "magnetic", name: "Free-ion saturation moment g_J·J", status: "DERIVED", evidenceClass: "MATHEMATICAL_DERIVATION",
    value: ho3.muSatInBohrMagnetons, unit: "μ_B per ion", derivation: `${HUND_DERIVATION}: μ_sat = g_J J μ_B`,
    notes: "Upper bound for a fully aligned free ion; the metal's measured moment may differ." },

  // ── magnetic: empirical, unsourced ──
  placeholder({ id: "ho.neel-temperature", category: "magnetic", name: "Helical antiferromagnetic ordering temperature T_N", unit: "K",
    conditions: "Bulk, zero applied field",
    recall: "Approximately 130 K. Unverified — requires a primary measurement reference.", notes: "Upper bound on the magnetically ordered regime." }),
  placeholder({ id: "ho.conical-transition", category: "magnetic", name: "Low-temperature conical / ferromagnetic transition T_C", unit: "K",
    conditions: "Bulk, zero applied field",
    recall: "Approximately 20 K. Unverified.", notes: "Relevant to cryogenic operation." }),
  placeholder({ id: "ho.saturation-magnetisation", category: "magnetic", name: "Saturation magnetisation of the metal M_s", unit: "A/m",
    conditions: "Specify temperature, field, crystal axis", notes: "Needed before any torque estimate for a real holmium component." }),
  placeholder({ id: "ho.anisotropy", category: "magnetic", name: "Magnetocrystalline anisotropy constants", unit: "J/m³",
    conditions: "Specify temperature and axes", notes: "Holmium is strongly anisotropic; an isotropic dipole model is a large simplification." }),

  // ── structural / thermal ──
  placeholder({ id: "ho.crystal-structure", category: "structural", name: "Crystal structure (room temperature)", unit: "—",
    recall: "Hexagonal close-packed. Unverified.", notes: "Determines the easy/hard magnetic axes." }),
  placeholder({ id: "ho.density", category: "structural", name: "Mass density ρ", unit: "kg/m³", conditions: "Specify temperature",
    recall: "Roughly 8.8 × 10³ kg/m³ near room temperature. Unverified.", notes: "Needed to compute a real disk's moment of inertia." }),
  placeholder({ id: "ho.specific-heat-lowT", category: "thermal", name: "Specific heat capacity at cryogenic temperature", unit: "J/(kg·K)",
    conditions: "Specify temperature", notes: "Needed for any cryogenic heat-load estimate." }),
  placeholder({ id: "ho.thermal-conductivity-lowT", category: "thermal", name: "Thermal conductivity at cryogenic temperature", unit: "W/(m·K)",
    conditions: "Specify temperature and purity", notes: "Sample purity dominates at low temperature." }),
];

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

export const HOLMIUM: MaterialRecord = deepFreeze({
  schema: MATERIAL_SCHEMA,
  element: { symbol: "Ho", name: "Holmium", atomicNumber: 67 },
  properties,
});
