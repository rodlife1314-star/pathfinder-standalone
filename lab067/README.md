# PATHFINDER LAB 067 — Phase 001 (foundational scaffolding)

First-principles research scaffold for Element 67 (holmium), Euler's rigid-body
equations, magnetic torque and precession. Governed by [GOVERNANCE.md](./GOVERNANCE.md).
Self-contained: the Pathfinder v0.1 code in the repository root is untouched.

```bash
cd lab067
npm install
npm test          # node:test, no extra test framework
npm run typecheck
npm run build && npm start   # http://localhost:3000
```

Requires Node ≥ 22.18 (native TypeScript type-stripping runs the tests).
Dependencies: next, react, react-dom, typescript, @types/* — nothing else.
Next.js telemetry is disabled in every npm script.

## Module map

| Responsibility | Path | Phase 001 state |
|---|---|---|
| Typed contracts, schema versions | `src/contracts/` | Implemented |
| Dimensional analysis (SI base dims) | `src/units/` | Implemented |
| Reference registry | `src/registry/` | Seed data, read-only; **0 Operator-verified citations** |
| Deterministic maths | `src/math/` | Vectors, quaternions, inertia, Euler, dipole torque, Hund's rules |
| Numerical simulation | `src/sim/` | RK4; rigid body + fixed dipole in uniform B |
| ORION reasoning kernel | `src/orion/` | Contract + admission guard only; **engine NOT IMPLEMENTED (no LLM)** |
| Crucible validation | `src/crucible/` | 10 executed checks, 3 NOT IMPLEMENTED |
| Evidence ledger | `src/ledger/` | SHA-256 hash-linked, tamper-evident; **in-memory, not durable** |
| UI / learning | `app/` | Status board (`/`), Euler learning page (`/learn/euler`) |

## Integrity notes

- Registry entries marked `AI_RECALL` were typed from the assistant's memory.
  Six have no source at all; the Crucible provenance check therefore reports
  **FAILED** until the Operator supplies and verifies citations.
- The ledger is tamper-*evident*, not tamper-*proof*: a full-chain rewrite is
  undetectable without external anchoring (not implemented). No signatures.
- Simulations use idealised test bodies, not holmium. No material, thermal,
  cryogenic, hardware, levitation or energy model exists.
- No architecture review by Jemma has been recorded.
