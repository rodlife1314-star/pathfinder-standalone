# Phase 002 development increment — magnetic dynamics and ORION hardening

**Branch:** `lab067/phase-002-dev` (from `lab067/orion-llm-dev` @ `6e67f8c`).
**Status:** development only; not merged into the Phase 001 baseline; not reviewed by Jemma.
**Authorisation:** Operator, 2026-11-03: “let’s continue with the build”. Scope chosen by the assistant from the
handover's open-gap list (stated to the Operator before work began): (1) magnetic torque in the Dynamics Lab,
(2) rate limiting and origin checks on `/api/orion`.

## 1. Magnetic torque in the Dynamics Lab

| Change | Detail |
|---|---|
| `src/physics/magnetic.ts` | `fastTopPrecessionRate` Ω_p ≈ −m₃\|B\|/(I₃ω₃); `fastTopEpsilon` ε = I⊥\|m\|\|B\|/(I₃ω₃)². Classical result (heavy symmetric top with mgl → \|m\|\|B\|); explanatory text by the assistant, citation pending. |
| `src/integration/observables.ts` | Post-processing: body-axis direction in world frame, unwrapped precession azimuth, nutation angle, U = −m·B series. |
| `src/crucible/validators.ts` | `validateMagneticSimulationInputs` (finite m, B; tilt ∈ [0, π]; Δt guard on √(\|m\|\|B\|/I_min); >50 T warning). `assessMagneticConservation`: E = T − m·B and L·B̂ judged; \|L\| reported as an INCONCLUSIVE control (not an invariant). |
| Crucible `analytic.fast-top-precession` | New falsification check (see below). |
| Dynamics Lab UI | Torque-model switch; m, B, tilt inputs; 3 magnetic presets; precession panel (measured vs approximation, ε, applicability caveats); ΔT/ΔU/ΔE, precession-angle and nutation charts; magnetic invariant error chart. |

### New Crucible check — measured, not assumed

Before setting criteria, the deviation from the approximation was measured at ω₃ = 10, 20, 40 rad/s:
relative deviation 1.15e-2, 2.89e-3, 6.73e-4 against ε = 1.25e-2, 3.13e-3, 7.81e-4 — i.e. ≈ 0.9 ε, scaling as ω₃⁻².
Criteria therefore: deviation < 2ε at ω₃ = 20 and 40, and fitted scaling exponent in [1.7, 2.3]. Result: **PASSED**
(deviations 2.893e-3 and 6.730e-4; exponent 2.10).

What this does and does not show: the integrator + magnetic-torque code reproduce known gyroscopic precession
of an ideal rigid dipole. It says **nothing** about holmium, support, levitation or feasibility: a uniform field
exerts zero net force.

## 2. `/api/orion` hardening

- Fixed-window rate limit per client (default 10/min, `ORION_RATE_LIMIT_PER_MIN`, bounded 1–600), returning 429 + `Retry-After`.
- Cross-origin browser POSTs refused (403). Requests without an `Origin` header are allowed — CSRF protection, not authentication.
- Limits: in-memory and per process (resets on restart; not shared across instances); client identity from `X-Forwarded-For` is spoofable.

## 3. Evidence

| Test | Result |
|---|---|
| `npm test` | **95 / 95 pass** (log: `docs/phase-002-dev-test-output.txt`) |
| Crucible | 20 checks: **14 PASSED, 1 FAILED** (prov.sourced-data — expected), **5 NOT IMPLEMENTED** |
| Browser — fast spin preset | E drift 1.15e-11, L·B̂ 3.05e-10 (PASSED); precession −0.124638 vs −0.125 rad/s, deviation 2.89e-3 ≈ ε 3.12e-3 |
| Browser — slow spin preset | Conservation PASSED; approximation correctly flagged inapplicable (ε = 0.14) |
| Browser — released from rest | Conservation PASSED; \|L₀\| = 0 handled (relative \|L\| change reported as undefined, not 2e298 — bug found and fixed in this increment) |
| Browser — invalid B | Rejected with per-field messages |
| Live server, limit 3/min | POST 1–3 → 502 (upstream unreachable), POST 4 → **429**, `Retry-After: 60`; foreign Origin → **403**; key absent from server log |
| Mobile 390 px | No horizontal scroll |

## 4. Still not implemented / not tested

- Live call to the NVIDIA model: NOT TESTED (host blocked by this session's network policy).
- Holmium magnetisation model; field gradients / forces; suspension and stability analysis; cryogenic model; durable ledger.
- Citations for the fast-top result and the other classical statements.
