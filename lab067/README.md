# PATHFINDER LAB 067 — Phase 001

Research scaffold for the **rotational dynamics of a proposed shaftless disk
incorporating holmium (Element 67)**, starting from Euler's rigid-body equations.
The disk is an **exploratory hypothesis, not an established or working device**.
Governed by [GOVERNANCE.md](./GOVERNANCE.md). Architecture handover:
[docs/HANDOVER-JEMMA-PHASE-001.md](./docs/HANDOVER-JEMMA-PHASE-001.md).

```bash
cd lab067
npm install
npm test            # 61 tests, node:test (no test framework dependency)
npm run typecheck
npm run build && npm start        # http://localhost:3000
```

Requires Node ≥ 22.18 (native TypeScript type-stripping runs the tests).
Runtime dependencies: `next`, `react`, `react-dom`. Dev: `typescript`, `@types/*`.
Next.js telemetry is disabled in every npm script.

## Sections

| Route | Section | State |
|---|---|---|
| `/` | Research Dashboard | Hypothesis status, live Crucible summary, constraints, gaps |
| `/materials` | Element 67 Registry | 0 sourced · 2 definitional · 4 derived · 11 placeholders; Operator proposal form → ledger |
| `/workbench` | Euler Equation Workbench | Working calculator, intermediate values, strict validation |
| `/simulation` | Dynamics Simulation Lab | Torque-free RK4, charts, conservation errors, step-halving estimate |
| `/orion` | ORION Reasoning Console | Static templates + keyword match; **no AI model**; full trace |
| `/crucible` | Scientific Crucible | 19 checks run in-browser: 13 PASSED, 1 FAILED, 5 NOT IMPLEMENTED |
| `/ledger` | Evidence Ledger | Hash-linked, **in-browser memory only (lost on reload)** |

## Source layout

| Module | Path | Responsibility |
|---|---|---|
| Application interface | `app/`, `src/ui/` | Next.js routes; client components |
| Physics calculations | `src/physics/` | Vectors, quaternions, inertia, Euler equations, dipole torque, Hund's rules |
| Numerical integration | `src/integration/` | RK4 step; rigid-body simulation records |
| Material reference schemas | `src/materials/` | Material schema + holmium record; laws/constants registry |
| ORION contracts | `src/orion/` | Contract guard, static knowledge, transparent console |
| Validation | `src/crucible/` | Input validators, conservation assessment, Crucible checks |
| Evidence records | `src/ledger/` | Canonical JSON, pure-TS SHA-256, hash-linked ledger |
| Shared contracts / units | `src/contracts/`, `src/units/` | Versioned schema ids, statuses, SI dimensional analysis |
| Automated tests | `test/` | 61 tests over all non-UI modules |

## Integrity summary

- No measured holmium value is stored. Placeholders hold `null`; recalled
  numbers appear only as labelled “assistant recall” text and calculations
  cannot read them (`requireUsableValue` throws).
- ORION never runs a model or computes numbers; it states so in every response.
- The ledger is tamper-evident, not tamper-proof, not signed, not persisted.
- No review by Jemma has been recorded.
