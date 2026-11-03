/**
 * Material reference schema (versioned). Phase 001: one record, Element 67.
 *
 * Data status — the core integrity rule:
 *   SOURCED      value + reference URL + Operator verification. (None yet.)
 *   DEFINITION   true by definition/convention (e.g. Z = 67). Not a measurement.
 *   DERIVED      computed by deterministic code inside a stated model. Not a measurement.
 *   PLACEHOLDER  field exists, value is NULL. No number is stored. An optional
 *                `assistantRecall` note may say what the assistant remembers —
 *                as text only, never usable by calculations.
 */
import type { EvidenceClass } from "../contracts/evidence.ts";

export const MATERIAL_SCHEMA = "lab067.material/0.1.0" as const;

export type DataStatus = "SOURCED" | "DEFINITION" | "DERIVED" | "PLACEHOLDER";
export type PropertyCategory = "identity" | "atomic" | "magnetic" | "structural" | "thermal";

export interface MaterialProperty {
  id: string;
  category: PropertyCategory;
  name: string;
  status: DataStatus;
  evidenceClass: EvidenceClass;
  /** null for every PLACEHOLDER. */
  value: number | string | null;
  /** SI unit or "1" (dimensionless) or "—" for non-numeric. */
  unit: string;
  /** Standard uncertainty in `unit`; null = unknown (never read as zero). */
  uncertainty: number | null;
  /** Temperature at which the value applies [K]; null = not applicable / unknown. */
  temperatureK: number | null;
  measurementConditions: string | null;
  referenceUrl: string | null;
  referenceCitation: string | null;
  verifiedBy: string | null;
  /** For DERIVED: the model and the code that computes it. */
  derivation: string | null;
  /** Free text, PLACEHOLDER only. What the assistant recalls — UNVERIFIED, not data. */
  assistantRecall: string | null;
  notes: string;
}

export interface MaterialRecord {
  schema: typeof MATERIAL_SCHEMA;
  element: { symbol: string; name: string; atomicNumber: number };
  properties: readonly MaterialProperty[];
}

export class PlaceholderValueError extends Error {}

/** The only sanctioned way for calculations to read a material value. */
export function requireUsableValue(p: MaterialProperty): number {
  if (p.status === "PLACEHOLDER") throw new PlaceholderValueError(`${p.id} is a PLACEHOLDER and cannot be used in calculations`);
  if (typeof p.value !== "number" || !Number.isFinite(p.value)) throw new PlaceholderValueError(`${p.id} has no numeric value`);
  return p.value;
}

/** Schema-rule check (used by the Crucible). Returns human-readable violations. */
export function materialRuleViolations(r: MaterialRecord): string[] {
  const v: string[] = [];
  const ids = new Set<string>();
  for (const p of r.properties) {
    if (ids.has(p.id)) v.push(`${p.id}: duplicate id`);
    ids.add(p.id);
    if (p.status === "PLACEHOLDER" && p.value !== null) v.push(`${p.id}: PLACEHOLDER must not carry a value`);
    if (p.status !== "PLACEHOLDER" && p.value === null) v.push(`${p.id}: ${p.status} requires a value`);
    if (p.status !== "PLACEHOLDER" && p.assistantRecall !== null) v.push(`${p.id}: assistantRecall allowed only on PLACEHOLDER`);
    if (p.status === "SOURCED") {
      if (!p.referenceUrl || !/^https:\/\/\S+$/.test(p.referenceUrl)) v.push(`${p.id}: SOURCED requires an https reference URL`);
      if (!p.verifiedBy) v.push(`${p.id}: SOURCED requires verifiedBy (Operator)`);
    }
    if (p.status === "DERIVED" && !p.derivation) v.push(`${p.id}: DERIVED requires a derivation`);
    if (p.status === "DERIVED" && p.evidenceClass !== "MATHEMATICAL_DERIVATION") v.push(`${p.id}: DERIVED must be MATHEMATICAL_DERIVATION`);
    if (p.status !== "SOURCED" && p.evidenceClass === "EMPIRICAL_MEASUREMENT" && p.value !== null) v.push(`${p.id}: unsourced empirical value`);
    if (p.temperatureK !== null && !(p.temperatureK >= 0)) v.push(`${p.id}: temperature must be ≥ 0 K`);
  }
  return v;
}
