import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalJSON } from "../src/ledger/canonical.ts";
import { EvidenceLedger, GENESIS_HASH, sha256Hex, verifyChain, type LedgerEntry } from "../src/ledger/ledger.ts";

const fixedClock = () => new Date("2026-01-01T00:00:00Z");

test("canonical JSON sorts keys and rejects lossy values", () => {
  assert.equal(canonicalJSON({ b: 1, a: [true, null, "x"] }), '{"a":[true,null,"x"],"b":1}');
  assert.equal(canonicalJSON({ a: 1, b: 2 }), canonicalJSON({ b: 2, a: 1 }));
  assert.throws(() => canonicalJSON({ x: NaN }));
  assert.throws(() => canonicalJSON({ x: Infinity }));
  assert.throws(() => canonicalJSON({ x: undefined }));
});

test("SHA-256 known-answer test", () => {
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("append links entries and verify passes", () => {
  const L = new EvidenceLedger(fixedClock);
  const a = L.append("operator", "operator-note", { text: "start" });
  const b = L.append("engine", "simulation", { n: 1 });
  assert.equal(a.prevHash, GENESIS_HASH);
  assert.equal(b.prevHash, a.hash);
  assert.deepEqual(L.verify(), { ok: true, length: 2, headHash: b.hash, firstBadIndex: null, reason: null });
});

test("deterministic hashing for identical content and clock", () => {
  const h = () => { const L = new EvidenceLedger(fixedClock); return L.append("operator", "operator-note", { z: 1, a: 2 }).hash; };
  assert.equal(h(), h());
});

test("entries are immutable and detached from caller objects", () => {
  const L = new EvidenceLedger(fixedClock);
  const payload = { value: 1 };
  const e = L.append("engine", "simulation", payload);
  payload.value = 999;
  assert.deepEqual(e.payload, { value: 1 });
  assert.throws(() => { (e as { hash: string }).hash = "x"; }, TypeError);
  assert.throws(() => { (e.payload as { value: number }).value = 2; }, TypeError);
  (L.entries() as LedgerEntry[]).pop();
  assert.equal(L.length, 1);
});

test("write permissions: ORION cannot write validations; Crucible cannot write notes", () => {
  const L = new EvidenceLedger(fixedClock);
  assert.throws(() => L.append("orion", "validation", {}), /permission denied/);
  assert.throws(() => L.append("orion", "reference-snapshot", {}), /permission denied/);
  assert.throws(() => L.append("engine", "validation", {}), /permission denied/);
  assert.throws(() => L.append("crucible", "operator-note", {}), /permission denied/);
  assert.equal(L.length, 0);
});

test("verify detects alteration, deletion, reordering and forged author", () => {
  const L = new EvidenceLedger(fixedClock);
  L.append("operator", "operator-note", { i: 0 });
  L.append("engine", "simulation", { i: 1 });
  L.append("crucible", "validation", { i: 2 });
  const es = L.entries().map((e) => JSON.parse(JSON.stringify(e)) as LedgerEntry);
  const altered = es.map((e, i) => (i === 2 ? { ...e, payload: { i: 99 } } : e));
  assert.equal(verifyChain(altered).firstBadIndex, 2);
  assert.equal(verifyChain([es[0]!, es[2]!]).ok, false);
  assert.equal(verifyChain([es[1]!, es[0]!, es[2]!]).ok, false);
  // Forge ORION as validation author with a correctly recomputed hash: permission rule still catches it.
  const { hash: _h, ...body } = { ...es[0]!, author: "orion" as const, kind: "validation" as const };
  const forged = { ...body, hash: sha256Hex(canonicalJSON(body)) };
  assert.match(verifyChain([forged]).reason ?? "", /not permitted/);
});
