/**
 * Append-only, hash-linked evidence ledger (Governance §7).
 *
 * WHAT IS IMPLEMENTED: each entry stores SHA-256(canonical(entry body incl.
 * prevHash)); verify() recomputes the whole chain and reports the first break.
 * Entries are deep-frozen; the API exposes no update or delete.
 *
 * WHAT IS NOT (do not claim otherwise):
 *   - Durable persistence: storage is in-memory and lost on process exit.
 *   - Tamper-PROOFING: the chain is tamper-EVIDENT only. Someone with write
 *     access to the storage could rewrite and re-hash the entire chain. External
 *     anchoring (e.g. Operator-held head-hash receipts) is not implemented.
 *   - Signatures / author authentication: `author` is a declared field, not a proof.
 */
import { createHash } from "node:crypto";
import { SCHEMA } from "../contracts/evidence.ts";
import { LAB_VERSION } from "../contracts/version.ts";
import { canonicalJSON } from "./canonical.ts";

export type LedgerAuthor = "operator" | "engine" | "crucible" | "orion";
export type LedgerKind = "reference-snapshot" | "simulation" | "validation" | "orion-proposal" | "operator-note";

/** Which authors may write which kinds. Enforces the ORION and Crucible boundaries. */
export const WRITE_PERMISSIONS: Readonly<Record<LedgerAuthor, readonly LedgerKind[]>> = Object.freeze({
  operator: ["operator-note", "reference-snapshot"],
  engine: ["simulation", "reference-snapshot"],
  crucible: ["validation"],
  orion: ["orion-proposal"],
});

export const GENESIS_HASH = "0".repeat(64);

export interface LedgerEntryBody {
  schema: typeof SCHEMA.ledgerEntry;
  index: number;
  timestamp: string;
  softwareVersion: string;
  author: LedgerAuthor;
  kind: LedgerKind;
  payload: unknown;
  prevHash: string;
}

export interface LedgerEntry extends LedgerEntryBody {
  hash: string;
}

export interface VerifyResult {
  ok: boolean;
  length: number;
  headHash: string;
  firstBadIndex: number | null;
  reason: string | null;
}

export const sha256Hex = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");

export const hashEntryBody = (b: LedgerEntryBody): string => sha256Hex(canonicalJSON(b));

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

export class EvidenceLedger {
  #entries: LedgerEntry[] = [];
  #clock: () => Date;

  constructor(clock: () => Date = () => new Date()) {
    this.#clock = clock;
  }

  append(author: LedgerAuthor, kind: LedgerKind, payload: unknown): LedgerEntry {
    if (!WRITE_PERMISSIONS[author]?.includes(kind)) {
      throw new Error(`Ledger permission denied: author "${author}" may not write kind "${kind}"`);
    }
    // Deep-copy through canonical JSON: validates the payload and detaches it from the caller.
    const detached = JSON.parse(canonicalJSON(payload)) as unknown;
    const prev = this.#entries.at(-1);
    const body: LedgerEntryBody = {
      schema: SCHEMA.ledgerEntry,
      index: this.#entries.length,
      timestamp: this.#clock().toISOString(),
      softwareVersion: LAB_VERSION,
      author,
      kind,
      payload: detached,
      prevHash: prev ? prev.hash : GENESIS_HASH,
    };
    const entry = deepFreeze({ ...body, hash: hashEntryBody(body) });
    this.#entries.push(entry);
    return entry;
  }

  get length(): number {
    return this.#entries.length;
  }

  /** Frozen entries; the returned array is a copy, so pushing to it does not affect the ledger. */
  entries(): readonly LedgerEntry[] {
    return [...this.#entries];
  }

  verify(): VerifyResult {
    return verifyChain(this.#entries);
  }
}

/** Verify any sequence of entries (e.g. one exported and re-imported). */
export function verifyChain(entries: readonly LedgerEntry[]): VerifyResult {
  let prevHash = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const fail = (reason: string): VerifyResult => ({ ok: false, length: entries.length, headHash: prevHash, firstBadIndex: i, reason });
    if (e.index !== i) return fail(`index ${e.index} ≠ position ${i}`);
    if (e.prevHash !== prevHash) return fail("prevHash does not match previous entry hash");
    const { hash, ...body } = e;
    let recomputed: string;
    try {
      recomputed = hashEntryBody(body);
    } catch (err) {
      return fail(`entry not canonicalisable: ${(err as Error).message}`);
    }
    if (recomputed !== hash) return fail("stored hash does not match recomputed hash (content altered)");
    if (!WRITE_PERMISSIONS[e.author]?.includes(e.kind)) return fail(`author "${e.author}" not permitted kind "${e.kind}"`);
    prevHash = hash;
  }
  return { ok: true, length: entries.length, headHash: prevHash, firstBadIndex: null, reason: null };
}
