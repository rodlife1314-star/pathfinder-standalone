/**
 * ORION reasoning-kernel contract (Governance §5).
 *
 * Phase 001 status: the CONTRACT and its enforcement guards are implemented and
 * tested. The reasoning engine itself (any language-model integration) is
 * NOT IMPLEMENTED — no LLM SDK or external service is included.
 */
import { SCHEMA, type EvidenceClass } from "../contracts/evidence.ts";
import type { EvidenceLedger, LedgerEntry } from "../ledger/ledger.ts";

export const ORION_PERMITTED = [
  "decompose-question",
  "propose-model",
  "explain-equation",
  "identify-missing-evidence",
  "suggest-numerical-experiment",
  "develop-counterexample",
  "explain-uncertainty",
] as const;
export type OrionProposalKind = (typeof ORION_PERMITTED)[number];

export const ORION_FORBIDDEN = [
  "declare-validated",
  "invent-evidence",
  "modify-immutable-record",
  "execute-external-action",
  "promote-hypothesis-to-fact",
] as const;

/** ORION may only ever speak in these epistemic classes. */
export const ORION_ALLOWED_CLASSES: readonly EvidenceClass[] = ["HYPOTHESIS", "UNVERIFIED_AI_EXPLANATION"];

export interface OrionProposal {
  schema: typeof SCHEMA.orionProposal;
  kind: OrionProposalKind;
  evidenceClass: "HYPOTHESIS" | "UNVERIFIED_AI_EXPLANATION";
  content: string;
  /** Registry ids the proposal relies on (not proof — just traceability). */
  references: readonly string[];
  /** Always true: nothing ORION says is validated until the Crucible checks it. */
  requiresValidation: true;
}

export class OrionContractViolation extends Error {}

/** Untrusted input shape — anything an LLM might emit. */
export type RawOrionOutput = Record<string, unknown>;

/**
 * Gate every ORION output through this function before it touches the ledger.
 * It rejects (never silently repairs) any attempt to cross the contract.
 */
export function admitOrionProposal(raw: RawOrionOutput): OrionProposal {
  const kind = raw["kind"];
  if (typeof kind !== "string") throw new OrionContractViolation("Proposal kind missing");
  if ((ORION_FORBIDDEN as readonly string[]).includes(kind)) throw new OrionContractViolation(`Forbidden action: ${kind}`);
  if (!(ORION_PERMITTED as readonly string[]).includes(kind)) throw new OrionContractViolation(`Unknown action: ${kind}`);

  const cls = raw["evidenceClass"];
  if (!ORION_ALLOWED_CLASSES.includes(cls as EvidenceClass)) {
    throw new OrionContractViolation(`ORION may not assert evidence class "${String(cls)}"`);
  }
  for (const k of ["status", "validated", "validationStatus"]) {
    if (k in raw) throw new OrionContractViolation(`ORION may not set "${k}"`);
  }
  if (raw["requiresValidation"] !== undefined && raw["requiresValidation"] !== true) {
    throw new OrionContractViolation("requiresValidation cannot be waived");
  }
  const content = raw["content"];
  if (typeof content !== "string" || content.trim() === "") throw new OrionContractViolation("Empty content");
  const refs = raw["references"] ?? [];
  if (!Array.isArray(refs) || !refs.every((r) => typeof r === "string")) throw new OrionContractViolation("references must be string[]");

  return {
    schema: SCHEMA.orionProposal,
    kind: kind as OrionProposalKind,
    evidenceClass: cls as OrionProposal["evidenceClass"],
    content,
    references: refs as string[],
    requiresValidation: true,
  };
}

/** The only path by which ORION output reaches the ledger. */
export function recordOrionProposal(ledger: EvidenceLedger, raw: RawOrionOutput): LedgerEntry {
  return ledger.append("orion", "orion-proposal", admitOrionProposal(raw));
}

export const ORION_ENGINE_STATUS = "NOT IMPLEMENTED" as const;
