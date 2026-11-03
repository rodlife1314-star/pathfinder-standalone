import { test } from "node:test";
import assert from "node:assert/strict";
import { admitOrionProposal, OrionContractViolation, recordOrionProposal } from "../src/orion/contract.ts";
import { EvidenceLedger } from "../src/ledger/ledger.ts";

const ok = { kind: "suggest-numerical-experiment", evidenceClass: "HYPOTHESIS", content: "Vary B and measure precession rate.", references: ["law.dipole-torque"] };

test("well-formed proposal is admitted and forced to requireValidation", () => {
  const p = admitOrionProposal(ok);
  assert.equal(p.requiresValidation, true);
  assert.equal(p.evidenceClass, "HYPOTHESIS");
});

test("ORION cannot assert established law or measurement", () => {
  assert.throws(() => admitOrionProposal({ ...ok, evidenceClass: "ESTABLISHED_LAW" }), OrionContractViolation);
  assert.throws(() => admitOrionProposal({ ...ok, evidenceClass: "EMPIRICAL_MEASUREMENT" }), OrionContractViolation);
});

test("ORION cannot declare validation or waive it", () => {
  assert.throws(() => admitOrionProposal({ ...ok, status: "PASSED" }), OrionContractViolation);
  assert.throws(() => admitOrionProposal({ ...ok, validated: true }), OrionContractViolation);
  assert.throws(() => admitOrionProposal({ ...ok, requiresValidation: false }), OrionContractViolation);
});

test("forbidden and unknown actions are rejected", () => {
  for (const kind of ["declare-validated", "invent-evidence", "modify-immutable-record", "execute-external-action", "promote-hypothesis-to-fact", "delete-ledger"]) {
    assert.throws(() => admitOrionProposal({ ...ok, kind }), OrionContractViolation, kind);
  }
});

test("recorded ORION proposals land only as orion-proposal entries", () => {
  const L = new EvidenceLedger();
  const e = recordOrionProposal(L, ok);
  assert.equal(e.author, "orion");
  assert.equal(e.kind, "orion-proposal");
  assert.throws(() => recordOrionProposal(L, { ...ok, evidenceClass: "ESTABLISHED_LAW" }));
  assert.equal(L.length, 1);
});
