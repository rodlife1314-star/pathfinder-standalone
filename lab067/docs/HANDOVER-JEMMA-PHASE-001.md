# Phase 001 — Architectural Handover for Independent Review

**To:** Jemma (Architecture & Governance Reviewer)
**From:** Engineering assistant (Claude Code), on behalf of the Human Operator
**Subject:** PATHFINDER LAB 067, Phase 001 scaffold, `lab067/` on branch `lab067/phase-001`
**Date:** 2026-11-03
**Review status:** **NOT REVIEWED.** This document requests review; it records no approval.

Everything below describes what exists in the code. Test and check results are
copied from executed runs (full test log: [phase-001-test-output.txt](./phase-001-test-output.txt)).
Where something is a claim I could not verify, it says so.

---

## 1. Scope delivered

| Brief item | Delivered | Notes |
|---|---|---|
| 1 Interface (7 sections, dark, responsive, accessible) | Yes | Dark-only theme. Verified no horizontal scroll at 390 px on all routes; keyboard-navigable charts; skip link; `aria-current` nav. No formal accessibility audit performed. |
| 2 Euler Workbench | Yes | Operator's sign convention; editable I, ω, τ; per-axis intermediate values; SI units; rejects non-numeric, non-finite, non-positive and triangle-inequality-violating inertia. |
| 3 Dynamics Simulation | Yes (torque-free) | RK4 + quaternion attitude; ω(t), T(t), \|L\|(t), log-scale conservation error; duration / Δt / tolerance controls; step-halving error estimate; limitations listed on-page. |
| 4 Holmium registry | Yes | Fields: value, unit, uncertainty, temperature, conditions, reference URL, citation, status. **0 sourced values.** |
| 5 ORION kernel | Yes (non-autonomous) | Typed query/response; static templates with keyword match and visible trace. No model. |
| 6 Crucible | Yes | 19 checks; 5 show NOT IMPLEMENTED; validators separate from engines. |
| 7 Evidence ledger | Yes (prototype) | In-browser memory; labelled non-persistent on every relevant page. |
| 8 Structure + docs + tests | Yes | See §2; 61 automated tests. |
| 9 Boundary | Stopped | No agents, hardware, cryogenic equipment or energy functions. |

## 2. Module architecture

```
              ┌──────────── app/ + src/ui/  (interface) ────────────┐
              │  pages, client components, in-browser ledger store  │
              └──┬──────────┬───────────┬─────────┬──────────┬──────┘
                 │          │           │         │          │
           src/physics  src/integration │    src/orion   src/ledger
           (pure maths)  (RK4, records) │   (contract,   (canonical JSON,
                 ▲          │  ▲        │    templates)   SHA-256, chain)
                 │          │  │        │       │  ▲          ▲
                 └──────────┘  │   src/crucible ┘  └──────────┤
                               └──── (validators, checks) ────┘
           src/materials ──► src/physics (Hund derivation only)
           all ──► src/contracts, src/units  (types, statuses, dimensions)
```

Actual import edges (from `grep` of `src/`, not from intent):

| Module | Imports |
|---|---|
| contracts | units |
| units | — |
| physics | — |
| integration | contracts, physics |
| materials | contracts, physics, units |
| ledger | contracts |
| orion | contracts, ledger |
| crucible | contracts, integration, ledger, materials, orion, physics, units |
| ui | contracts, crucible, integration, ledger, materials, orion, physics |

**Boundary properties that hold:** the calculation engines (`physics`,
`integration`) import nothing from `crucible`, `orion`, `ledger` or `ui`.
ORION cannot reach the engines. No module except the UI depends on React/Next.

## 3. Enforcement mechanisms (and their limits)

| Rule | Mechanism | Tested by | Limit |
|---|---|---|---|
| ORION cannot validate or promote hypotheses | `admitOrionProposal` rejects forbidden kinds, any class other than HYPOTHESIS/UNVERIFIED_AI_EXPLANATION, any status field, waived validation | `test/orion.test.ts`; Crucible `orion.contract-enforcement` | Only applies if callers route through the guard; TypeScript visibility, not a process boundary |
| Only Crucible writes validations | `WRITE_PERMISSIONS` checked on append and re-checked in `verifyChain` | `test/ledger.test.ts` | `author` is declared, not authenticated |
| Ledger append-only, tamper-evident | No update/delete API; deep-frozen entries; SHA-256 over canonical JSON incl. prevHash | unit tests + Crucible `integrity.ledger-tamper-evidence` | Whole-chain rewrite undetectable (no anchoring); no signatures; in-memory only |
| No unsourced measurements stored | PLACEHOLDER ⇒ `value === null`; `requireUsableValue` throws | `test/materials.test.ts`; Crucible `prov.material-rules` | “SOURCED” requires an https URL + `verifiedBy`, but the app never fetches or checks the URL |
| Registry immutable at runtime | `deepFreeze` | registry/material tests | Changes go through code commits — review process is the real control |
| Validation separate from calculation | Engines have no imports from `crucible` | import graph above | — |
| PASSED only after execution | `executedAt` set only when `run()` executes | `test/crucible.test.ts` | Criteria thresholds are my choices (see §7) |

## 4. Versioned schemas

`lab067.reference/0.1.0`, `lab067.material/0.1.0`, `lab067.simulation/0.1.0`,
`lab067.crucible-check/0.1.0`, `lab067.ledger-entry/0.1.0`,
`lab067.orion-proposal/0.1.0`, `lab067.orion-console/0.1.0`.
No migration mechanism exists yet.

## 5. Executed results

**Automated tests** (`npm test`, Node v22.23.4): **61 tests, 61 pass, 0 fail.**
Mutation sanity check (earlier in Phase 001): flipping one sign in Euler's equations made 3 tests and a Crucible check fail.
One test initially failed during this phase because *my* hand-calculated expectation was wrong (axis-3 sign); the engine was right and the test was corrected — noted for transparency.

**Crucible** (19 checks, executed in Node and in Chromium):

| Status | Count | Checks |
|---|---|---|
| PASSED | 13 | dim.euler-equation, init.input-admissibility, cons.torque-free (drift ~2e-14), cons.magnetic (~1e-13), conv.rk4-order (4.000, 4.000), analytic.symmetric-top (4e-10 rad/s), falsify.intermediate-axis, repro.deterministic, inputs.validator-rejects-invalid, math.workbench-form-equivalence (1.2e-14), prov.material-rules, orion.contract-enforcement, integrity.ledger-tamper-evidence |
| FAILED | 1 | **prov.sourced-data** — 0 sourced holmium values, 0/5 references Operator-verified, 2 references with no source. Correct outcome. |
| NOT IMPLEMENTED | 5 | orion.inference-engine, hyp.shaftless-suspension, ho.material-model, cryo.thermal-constraints, integrity.ledger-persistence |

**Browser end-to-end** (Playwright, Chromium, production build): every section exercised —
invalid inputs rejected with messages; coarse-Δt run correctly reports FAILED conservation (T 1.36e-6, L 7.85e-6 vs 1e-6);
Δt = 2 s refused; unmatched ORION question answered "No matching template"; 24 ledger entries verified intact; no console errors; no horizontal scroll at 390 px.

## 6. Decisions taken without prior explicit approval — please assess

1. **Pure-TypeScript SHA-256** (`src/ledger/sha256.ts`) instead of Web Crypto / node:crypto, so one ledger implementation runs in browser and Node synchronously. Verified against FIPS 180-4 vectors and node:crypto for 200 inputs. Hand-rolled crypto is a review risk.
2. **Next.js telemetry disabled** (it is on by default — an undeclared external service).
3. **Directory renames** (`math→physics`, `sim→integration`, `registry→materials`) to match the brief's module list.
4. **Learning page folded into the Workbench** (symbols, units, assumptions, verification steps).
5. **Placeholder rule tightened**: recalled numbers moved out of data fields into text notes (including cryogenic boiling points).
6. **Simulation step-size guard** (refuse > 0.5 rad/step, warn > 0.1) — a heuristic, not a stability proof.
7. **Dashboard “Established constraints”** (energy conservation, Earnshaw's theorem, intermediate-axis/dissipation) — explanatory text by the assistant; citations pending.

## 7. Known limitations

- Ledger: non-persistent, unsigned, unanchored, single-tab.
- Conservation checks judge sampled points (≤ ~800), not every step.
- Crucible thresholds (1e-8, 1e-9, order 3.7–4.3, etc.) were chosen by the assistant; not derived from a stated requirement.
- RK4 is non-symplectic; long-run drift is measured, not prevented.
- Reproducibility tested on one machine/runtime only.
- Magnetic model is a fixed point dipole in uniform B (engine only; not exposed in the UI).
- ORION keyword matching is crude; ranking ties broken alphabetically.
- No formal accessibility audit; dark theme only.
- Workbench preset “Asymmetric body” (1, 2, 3) sits on the planar limit and shows a (correct) warning.

## 8. Not implemented

ORION inference engine · holmium material model · field gradients/forces · suspension & stability analysis ·
cryogenic thermal model · durable/signed ledger · authentication of ledger authors · schema migrations ·
magnetic torque in the Dynamics Lab UI. Out of scope by governance: hardware control, experiments, autonomous agents, levitation or energy claims.

## 9. Questions for the reviewer

1. Is `orion → ledger` (ORION's recorder writes via the guard) an acceptable edge, or should recording be mediated only by the UI/Operator?
2. Is `materials → physics` (registry computing Hund's-rules values at load time) acceptable, or should derived values be produced by the engine and recorded separately?
3. Is the hand-written SHA-256 acceptable for a prototype, or should Phase 002 switch to Web Crypto with an async ledger API?
4. Are the Crucible tolerances appropriate, and should they be Operator-set configuration?
5. Should “SOURCED” require a second verifier, or a stored checksum/snapshot of the source document?
6. What persistence design (if any) should Phase 002 adopt, and what anchoring would satisfy Governance §7?

---
*Prepared for review; not a completion certificate. Operator authorisation is required before Phase 002.*
