import type { Citation, EntryOrigin, EvidenceClass, Quantity } from "../contracts/evidence.ts";
import type { SCHEMA } from "../contracts/evidence.ts";

export interface ReferenceRecord {
  schema: typeof SCHEMA.reference;
  id: string;
  title: string;
  evidenceClass: EvidenceClass;
  origin: EntryOrigin;
  statement: string;
  quantity: Quantity | null;
  citation: Citation;
  /** Conditions under which the statement is claimed to hold. */
  conditions: readonly string[];
  limitations: readonly string[];
}
