import type { SCHEMA, ValidationStatus } from "../contracts/evidence.ts";

export type CheckCategory =
  | "dimensional"
  | "conservation"
  | "convergence"
  | "initial-boundary"
  | "provenance"
  | "reproducibility"
  | "falsification"
  | "integrity";

export interface CheckResult {
  schema: typeof SCHEMA.check;
  id: string;
  title: string;
  category: CheckCategory;
  status: ValidationStatus;
  /** What was tested and why it matters. */
  method: string;
  /** Outcome detail, written from measured values only. */
  detail: string;
  /** Raw measured numbers (empty when not executed). */
  measured: Record<string, number>;
  /** ISO time the check actually executed; null ⇒ it did not run. */
  executedAt: string | null;
  durationMs: number | null;
}

export interface CrucibleReport {
  softwareVersion: string;
  runtime: string;
  startedAt: string;
  checks: CheckResult[];
  summary: Record<ValidationStatus, number>;
}
