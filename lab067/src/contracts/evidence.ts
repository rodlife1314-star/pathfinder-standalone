/**
 * Shared, versioned contracts for research records (Governance §3, §6, §7).
 * Every module communicates through these types; nothing here has behaviour.
 */
import type { Dimension } from "../units/dimension.ts";

export const SCHEMA = {
  reference: "lab067.reference/0.1.0",
  simulation: "lab067.simulation/0.1.0",
  check: "lab067.crucible-check/0.1.0",
  ledgerEntry: "lab067.ledger-entry/0.1.0",
  orionProposal: "lab067.orion-proposal/0.1.0",
} as const;

/** Epistemic class of a claim (Governance §3). */
export type EvidenceClass =
  | "ESTABLISHED_LAW"
  | "EMPIRICAL_MEASUREMENT"
  | "MATHEMATICAL_DERIVATION"
  | "NUMERICAL_SIMULATION"
  | "HYPOTHESIS"
  | "UNVERIFIED_AI_EXPLANATION";

/** The only validation statuses the system may display (Governance §6). */
export const VALIDATION_STATUSES = [
  "NOT IMPLEMENTED",
  "NOT TESTED",
  "PASSED",
  "FAILED",
  "INCONCLUSIVE",
] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

/**
 * How a citation stands:
 *  - OPERATOR_VERIFIED: the Operator has checked the value against the named source.
 *  - IDENTIFIED_UNCHECKED: a real source is named, but nobody has yet checked the value against it.
 *  - NONE: no source. The value must not be relied upon.
 */
export type CitationStatus = "OPERATOR_VERIFIED" | "IDENTIFIED_UNCHECKED" | "NONE";

export interface Citation {
  status: CitationStatus;
  /** Human-readable source identifier. Null when status is NONE. Never a fabricated URL/DOI. */
  source: string | null;
  verifiedBy?: string;
  verifiedOn?: string;
}

/** How the record entered the registry. AI_RECALL = typed in by the assistant from training memory. */
export type EntryOrigin = "OPERATOR" | "AI_RECALL" | "COMPUTED";

export interface Quantity {
  value: number;
  /** Display unit, SI. */
  unit: string;
  dimension: Dimension;
  /** Standard uncertainty in the same unit; null = unknown (NOT zero). */
  uncertainty: number | null;
}
