import { test } from "node:test";
import assert from "node:assert/strict";
import { VALIDATION_STATUSES } from "../src/contracts/evidence.ts";
import { runCrucible, recordReport } from "../src/crucible/crucible.ts";
import { EvidenceLedger } from "../src/ledger/ledger.ts";

const report = runCrucible();

test("only governance statuses appear", () => {
  for (const c of report.checks) assert.ok((VALIDATION_STATUSES as readonly string[]).includes(c.status), c.id);
});

test("PASSED/FAILED/INCONCLUSIVE only with a recorded execution; NOT IMPLEMENTED never executed", () => {
  for (const c of report.checks) {
    if (c.status === "NOT IMPLEMENTED" || c.status === "NOT TESTED") assert.equal(c.executedAt, null, c.id);
    else assert.ok(c.executedAt && c.durationMs !== null, c.id);
  }
});

test("expected Phase 001 outcomes", () => {
  const s = Object.fromEntries(report.checks.map((c) => [c.id, c.status]));
  for (const id of ["dim.euler-equation", "init.input-admissibility", "cons.torque-free", "cons.magnetic", "conv.rk4-order",
    "analytic.symmetric-top", "falsify.intermediate-axis", "repro.deterministic", "integrity.ledger-tamper-evidence",
    "inputs.validator-rejects-invalid", "math.workbench-form-equivalence", "prov.material-rules", "orion.contract-enforcement"]) {
    assert.equal(s[id], "PASSED", id);
  }
  // References with no source exist (cryogenic placeholders): provenance must NOT pass.
  assert.equal(s["prov.sourced-data"], "FAILED");
  for (const id of ["orion.inference-engine", "hyp.shaftless-suspension", "ho.material-model", "cryo.thermal-constraints", "integrity.ledger-persistence"]) assert.equal(s[id], "NOT IMPLEMENTED", id);
});

test("summary counts match checks", () => {
  const total = Object.values(report.summary).reduce((a, b) => a + b, 0);
  assert.equal(total, report.checks.length);
});

test("report can be recorded to the ledger and the chain verifies", () => {
  const L = new EvidenceLedger();
  recordReport(L, report);
  assert.equal(L.length, report.checks.length);
  assert.ok(L.verify().ok);
  assert.ok(L.entries().every((e) => e.author === "crucible" && e.kind === "validation"));
});
