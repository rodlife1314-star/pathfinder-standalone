/**
 * Scientific Crucible — independent validation (Governance §6).
 *
 * Separation rule: this module only CALLS the maths/sim engines and compares
 * against independent references (analytic solutions, invariants, known
 * theorems). It never generates models, and it is the only ledger author
 * allowed to write "validation" entries.
 *
 * Integrity rule: a check is PASSED only if its `run` function executed and
 * its measured values met an explicit, stated criterion.
 */
import { SCHEMA, VALIDATION_STATUSES, type ValidationStatus } from "../contracts/evidence.ts";
import { LAB_VERSION } from "../contracts/version.ts";
import { symmetricTopOmega } from "../physics/euler.ts";
import { checkPrincipalInertia, solidCylinder } from "../physics/inertia.ts";
import { fromAxisAngle, IDENTITY } from "../physics/quaternion.ts";
import { dot, norm, scale, sub, type Vec3 } from "../physics/vec3.ts";
import { REGISTRY } from "../materials/references.ts";
import { HOLMIUM } from "../materials/holmium.ts";
import { materialRuleViolations, requireUsableValue, PlaceholderValueError } from "../materials/material-schema.ts";
import { eulerAngularAcceleration as engineAccel, eulerWorking } from "../physics/euler.ts";
import { parseNumericField, validateEulerInputs, validateSimulationInputs } from "./validators.ts";
import { admitOrionProposal, OrionContractViolation } from "../orion/contract.ts";
import { simulate, validateInputs, type RigidBodyParams, type RigidBodyState, type RunConfig } from "../integration/rigid-body.ts";
import { canonicalJSON } from "../ledger/canonical.ts";
import { EvidenceLedger, sha256Hex, verifyChain, type LedgerEntry } from "../ledger/ledger.ts";
import { D, divDim, formatDim, mulDim, sameDim } from "../units/dimension.ts";
import type { CheckCategory, CheckResult, CrucibleReport } from "./types.ts";

interface Outcome {
  status: ValidationStatus;
  detail: string;
  measured?: Record<string, number>;
}

interface CheckDef {
  id: string;
  title: string;
  category: CheckCategory;
  method: string;
  /** Absent ⇒ NOT IMPLEMENTED. */
  run?: () => Outcome;
}

const ZERO: Vec3 = [0, 0, 0];
const fmt = (x: number) => x.toExponential(3);

/** Max relative deviation of a scalar series from its first value. */
function maxRelDrift(xs: number[]): number {
  const x0 = xs[0]!;
  const ref = Math.abs(x0) > 0 ? Math.abs(x0) : 1;
  return Math.max(...xs.map((x) => Math.abs(x - x0) / ref));
}

// ── Check definitions ───────────────────────────────────────────────────────

const checks: CheckDef[] = [
  {
    id: "dim.euler-equation",
    title: "Euler's equation is dimensionally consistent",
    category: "dimensional",
    method:
      "Compute dimensions of each term of I·ω̇ = (I_j − I_k)ω_jω_k + τ and of m × B; all must equal N·m. " +
      "Self-test: the checker must also REJECT a deliberately wrong term (I·ω, which is angular momentum).",
    run: () => {
      const lhs = mulDim(D.momentOfInertia, D.angularAcceleration);
      const gyro = mulDim(D.momentOfInertia, mulDim(D.angularVelocity, D.angularVelocity));
      const mxB = mulDim(D.magneticMoment, D.magneticFluxDensity);
      const wrong = mulDim(D.momentOfInertia, D.angularVelocity);
      const okTerms = [lhs, gyro, D.torque, mxB].every((d) => sameDim(d, D.torque));
      const detectsWrong = !sameDim(wrong, D.torque);
      const accelFromTorque = divDim(D.torque, D.momentOfInertia);
      const okInverse = sameDim(accelFromTorque, D.angularAcceleration);
      const pass = okTerms && detectsWrong && okInverse;
      return {
        status: pass ? "PASSED" : "FAILED",
        detail: `I·ω̇ → ${formatDim(lhs)}; gyroscopic → ${formatDim(gyro)}; m×B → ${formatDim(mxB)}; ` +
          `wrong term I·ω → ${formatDim(wrong)} (${detectsWrong ? "correctly rejected" : "NOT rejected"}). ` +
          "Note: torque and energy share a dimension, so this check is necessary, not sufficient.",
      };
    },
  },
  {
    id: "init.input-admissibility",
    title: "Initial conditions and parameters are physically admissible",
    category: "initial-boundary",
    method:
      "A solid cylinder's inertia must be accepted; counterexample I = (1, 1, 3) kg·m² (violates I1 + I2 ≥ I3) " +
      "must be rejected; a non-unit initial quaternion must be rejected; dt ≤ 0 must be rejected.",
    run: () => {
      const good = checkPrincipalInertia(solidCylinder(1, 0.05, 0.2)).valid;
      const badInertiaRejected = !checkPrincipalInertia([1, 1, 3]).valid;
      const p: RigidBodyParams = { inertia: [1, 2, 2.5], magneticMomentBody: ZERO, fieldWorld: ZERO };
      const badQRejected = validateInputs(p, { q: [1, 1, 0, 0], omega: [0, 0, 1] }, { dt: 0.01, steps: 1, sampleEvery: 1, renormalise: true }).length > 0;
      const badDtRejected = validateInputs(p, { q: IDENTITY, omega: [0, 0, 1] }, { dt: 0, steps: 1, sampleEvery: 1, renormalise: true }).length > 0;
      const all = good && badInertiaRejected && badQRejected && badDtRejected;
      return {
        status: all ? "PASSED" : "FAILED",
        detail: `cylinder accepted: ${good}; (1,1,3) rejected: ${badInertiaRejected}; non-unit q rejected: ${badQRejected}; dt=0 rejected: ${badDtRejected}. ` +
          "Boundary conditions: none exist in Phase 001 (initial-value ODE only).",
      };
    },
  },
  {
    id: "cons.torque-free",
    title: "Torque-free motion conserves energy and world angular momentum",
    category: "conservation",
    method:
      "Asymmetric body I = (0.02, 0.03, 0.04) kg·m², B = 0, ω₀ = (0.5, 3.0, 1.0) rad/s, dt = 1 ms, 20 s. " +
      "Criterion: max relative drift of E and of |L_world − L_world(0)|/|L₀| both < 1e-8.",
    run: () => {
      const p: RigidBodyParams = { inertia: [0.02, 0.03, 0.04], magneticMomentBody: ZERO, fieldWorld: ZERO };
      const rec = simulate(p, { q: IDENTITY, omega: [0.5, 3.0, 1.0] }, { dt: 1e-3, steps: 20000, sampleEvery: 100, renormalise: true });
      const eDrift = maxRelDrift(rec.samples.map((s) => s.energy));
      const L0 = rec.samples[0]!.angularMomentumWorld;
      const lDrift = Math.max(...rec.samples.map((s) => norm(sub(s.angularMomentumWorld, L0)) / norm(L0)));
      const tol = 1e-8;
      return {
        status: eDrift < tol && lDrift < tol ? "PASSED" : "FAILED",
        detail: `energy drift ${fmt(eDrift)}, angular-momentum drift ${fmt(lDrift)} (tolerance ${fmt(tol)}).`,
        measured: { energyRelDrift: eDrift, angularMomentumRelDrift: lDrift, tolerance: tol },
      };
    },
  },
  {
    id: "cons.magnetic",
    title: "Dipole in uniform field conserves total energy and L·B̂",
    category: "conservation",
    method:
      "I = (0.02, 0.03, 0.04) kg·m², m_body = (0, 0, 1) A·m², B = (0, 0, 0.1) T, body tilted 0.6 rad about x, " +
      "ω₀ = (0.2, -0.4, 5.0) rad/s, dt = 1 ms, 20 s. Criterion: drifts of E = T − m·B and of L·B̂ < 1e-8 (relative).",
    run: () => {
      const B: Vec3 = [0, 0, 0.1];
      const p: RigidBodyParams = { inertia: [0.02, 0.03, 0.04], magneticMomentBody: [0, 0, 1], fieldWorld: B };
      const rec = simulate(p, { q: fromAxisAngle([1, 0, 0], 0.6), omega: [0.2, -0.4, 5.0] }, { dt: 1e-3, steps: 20000, sampleEvery: 100, renormalise: true });
      const Bhat = scale(B, 1 / norm(B));
      const eDrift = maxRelDrift(rec.samples.map((s) => s.energy));
      const lbDrift = maxRelDrift(rec.samples.map((s) => dot(s.angularMomentumWorld, Bhat)));
      const L0 = rec.samples[0]!.angularMomentumWorld;
      const lPerpChange = Math.max(...rec.samples.map((s) => norm(sub(s.angularMomentumWorld, L0)))) / norm(L0);
      const tol = 1e-8;
      return {
        status: eDrift < tol && lbDrift < tol ? "PASSED" : "FAILED",
        detail: `energy drift ${fmt(eDrift)}, L·B̂ drift ${fmt(lbDrift)} (tolerance ${fmt(tol)}). ` +
          `Control: total |ΔL|/|L₀| reached ${fmt(lPerpChange)} — L itself is NOT conserved (torque acts), as expected.`,
        measured: { energyRelDrift: eDrift, LdotBhatRelDrift: lbDrift, LvectorRelChange: lPerpChange, tolerance: tol },
      };
    },
  },
  {
    id: "conv.rk4-order",
    title: "Integrator converges at the theoretical 4th order",
    category: "convergence",
    method:
      "Symmetric top I = (0.02, 0.02, 0.035) kg·m², ω₀ = (0.4, 0.0, 10) rad/s, T = 2 s. Error vs analytic ω(T) " +
      "at dt = 0.02, 0.01, 0.005 s. Observed order p = log₂(e(h)/e(h/2)); criterion 3.7 ≤ p ≤ 4.3 for both halvings.",
    run: () => {
      const Ip = 0.02, I3 = 0.035;
      const w0: Vec3 = [0.4, 0, 10];
      const T = 2;
      const exact = symmetricTopOmega(Ip, I3, w0, T);
      const p: RigidBodyParams = { inertia: [Ip, Ip, I3], magneticMomentBody: ZERO, fieldWorld: ZERO };
      const err = (h: number) => {
        const steps = Math.round(T / h);
        const rec = simulate(p, { q: IDENTITY, omega: w0 }, { dt: h, steps, sampleEvery: steps, renormalise: false });
        return norm(sub(rec.samples.at(-1)!.omega, exact));
      };
      const [e1, e2, e3] = [err(0.02), err(0.01), err(0.005)];
      const p1 = Math.log2(e1 / e2), p2 = Math.log2(e2 / e3);
      const ok = [p1, p2].every((x) => x >= 3.7 && x <= 4.3);
      return {
        status: ok ? "PASSED" : "FAILED",
        detail: `errors ${fmt(e1)}, ${fmt(e2)}, ${fmt(e3)} rad/s → observed orders ${p1.toFixed(3)}, ${p2.toFixed(3)}.`,
        measured: { e_h: e1, e_h2: e2, e_h4: e3, order1: p1, order2: p2 },
      };
    },
  },
  {
    id: "analytic.symmetric-top",
    title: "Simulation matches analytic torque-free symmetric-top precession",
    category: "falsification",
    method:
      "Independent reference: for I1 = I2, ω rotates about the body symmetry axis at Ω = (I3 − I⊥)ω3/I⊥. " +
      "Same top as above, dt = 1 ms, 5 s; criterion max |ω_sim − ω_exact| < 1e-9 rad/s.",
    run: () => {
      const Ip = 0.02, I3 = 0.035;
      const w0: Vec3 = [0.4, 0, 10];
      const p: RigidBodyParams = { inertia: [Ip, Ip, I3], magneticMomentBody: ZERO, fieldWorld: ZERO };
      const rec = simulate(p, { q: IDENTITY, omega: w0 }, { dt: 1e-3, steps: 5000, sampleEvery: 10, renormalise: true });
      const maxErr = Math.max(...rec.samples.map((s) => norm(sub(s.omega, symmetricTopOmega(Ip, I3, w0, s.t)))));
      return {
        status: maxErr < 1e-9 ? "PASSED" : "FAILED",
        detail: `max deviation from analytic solution ${fmt(maxErr)} rad/s over ${rec.samples.length} samples.`,
        measured: { maxAbsError: maxErr, tolerance: 1e-9 },
      };
    },
  },
  {
    id: "falsify.intermediate-axis",
    title: "Intermediate-axis theorem reproduced (stability counterexample)",
    category: "falsification",
    method:
      "Known theorem: rotation about the axis of intermediate inertia is unstable; about the largest/smallest it is stable. " +
      "I = (1, 2, 3) kg·m², spin 1 rad/s about each axis with 1e-3 rad/s perturbations, 40 s. " +
      "Engine is FALSIFIED unless: intermediate-axis perturbation grows above 0.1 rad/s AND both other axes stay below 0.01 rad/s.",
    run: () => {
      const p: RigidBodyParams = { inertia: [1, 2, 3], magneticMomentBody: ZERO, fieldWorld: ZERO };
      const eps = 1e-3;
      const cfg: RunConfig = { dt: 1e-3, steps: 40000, sampleEvery: 50, renormalise: true };
      const maxPerp = (axis: 0 | 1 | 2): number => {
        const w = [eps, eps, eps] as [number, number, number];
        w[axis] = 1;
        const rec = simulate(p, { q: IDENTITY, omega: w }, cfg);
        return Math.max(...rec.samples.map((s) => Math.hypot(...s.omega.filter((_, i) => i !== axis))));
      };
      const [m1, m2, m3] = [maxPerp(0), maxPerp(1), maxPerp(2)];
      const ok = m2 > 0.1 && m1 < 0.01 && m3 < 0.01;
      return {
        status: ok ? "PASSED" : "FAILED",
        detail: `max perpendicular |ω| — minor axis: ${fmt(m1)}, intermediate: ${fmt(m2)}, major: ${fmt(m3)} rad/s.`,
        measured: { minorAxisMaxPerp: m1, intermediateAxisMaxPerp: m2, majorAxisMaxPerp: m3 },
      };
    },
  },
  {
    id: "repro.deterministic",
    title: "Identical inputs reproduce bit-identical outputs",
    category: "reproducibility",
    method: "Run the magnetic scenario twice; SHA-256 of canonical JSON of both records must match. (Same machine/runtime only — cross-platform reproducibility NOT tested.)",
    run: () => {
      const p: RigidBodyParams = { inertia: [0.02, 0.03, 0.04], magneticMomentBody: [0, 0, 1], fieldWorld: [0, 0, 0.1] };
      const s: RigidBodyState = { q: fromAxisAngle([1, 0, 0], 0.6), omega: [0.2, -0.4, 5.0] };
      const c: RunConfig = { dt: 1e-3, steps: 2000, sampleEvery: 10, renormalise: true };
      const h1 = sha256Hex(canonicalJSON(simulate(p, s, c)));
      const h2 = sha256Hex(canonicalJSON(simulate(p, s, c)));
      return { status: h1 === h2 ? "PASSED" : "FAILED", detail: `run 1 ${h1.slice(0, 16)}…, run 2 ${h2.slice(0, 16)}…` };
    },
  },
  {
    id: "inputs.validator-rejects-invalid",
    title: "Input validators reject non-numeric and nonphysical inputs",
    category: "initial-boundary",
    method:
      "Feed the Workbench/Simulation validators known-bad inputs: empty string, \"abc\", \"0x10\", \"Infinity\", \"1e400\", " +
      "zero and negative inertia, I = (1, 1, 3), Δt = 0, and an over-long run. Each must be rejected; one valid input must be accepted.",
    run: () => {
      const bad = ["", "  ", "abc", "0x10", "Infinity", "1e400", "1,5", "NaN"];
      const parsedBad = bad.filter((b) => parseNumericField(b, "x").ok);
      const goodParse = ["1", "-2.5", "3e-4", ".5", "+7E2"].every((g) => parseNumericField(g, "x").ok);
      const z = ["0", "0", "0"] as const;
      const eb = (I: [string, string, string]) => validateEulerInputs({ inertia: I, omega: z, torque: z }).status === "FAILED";
      const eulerRejects = [eb(["0", "1", "1"]), eb(["-1", "2", "2"]), eb(["1", "1", "3"]), eb(["1", "", "1"])];
      const eulerAccepts = validateEulerInputs({ inertia: ["1", "2", "2.5"], omega: ["0.1", "0", "5"], torque: z }).status === "PASSED";
      const sb = (dur: string, dt: string) => validateSimulationInputs({ inertia: ["1", "2", "2.5"], omega: ["0", "0", "1"], duration: dur, dt }).status === "FAILED";
      const simRejects = [sb("10", "0"), sb("-1", "0.01"), sb("1e6", "0.001")];
      const ok = parsedBad.length === 0 && goodParse && eulerRejects.every(Boolean) && eulerAccepts && simRejects.every(Boolean);
      return {
        status: ok ? "PASSED" : "FAILED",
        detail: `bad strings accepted: ${parsedBad.length ? parsedBad.map((x) => JSON.stringify(x)).join(", ") : "none"}; ` +
          `valid numbers accepted: ${goodParse}; nonphysical inertia rejected: ${eulerRejects.filter(Boolean).length}/4; ` +
          `valid Euler input accepted: ${eulerAccepts}; bad simulation configs rejected: ${simRejects.filter(Boolean).length}/3.`,
      };
    },
  },
  {
    id: "math.workbench-form-equivalence",
    title: "Workbench equation form agrees with the engine",
    category: "dimensional",
    method:
      "The Workbench uses I_iω̇_i = τ_i − (I_k − I_j)ω_jω_k; the integrator uses (I_j − I_k)ω_jω_k + τ_i. " +
      "Compare both on 1000 deterministic pseudo-random admissible inputs; criterion max relative difference < 1e-12.",
    run: () => {
      let seed = 67;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
      let maxRel = 0;
      for (let n = 0; n < 1000; n++) {
        const a = 0.1 + rnd(), b = 0.1 + rnd();
        const I: Vec3 = [a, b, Math.abs(a - b) + rnd() * (a + b - Math.abs(a - b))];
        const w: Vec3 = [rnd() * 20 - 10, rnd() * 20 - 10, rnd() * 20 - 10];
        const tau: Vec3 = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
        const e1 = engineAccel(I, w, tau);
        const e2 = eulerWorking(I, w, tau).axes.map((x) => x.angularAcceleration);
        for (let i = 0; i < 3; i++) maxRel = Math.max(maxRel, Math.abs(e1[i]! - e2[i]!) / Math.max(1e-300, Math.abs(e1[i]!)));
      }
      return { status: maxRel < 1e-12 ? "PASSED" : "FAILED", detail: `max relative difference ${fmt(maxRel)} over 1000 inputs.`, measured: { maxRelativeDifference: maxRel } };
    },
  },
  {
    id: "prov.material-rules",
    title: "Material record obeys sourcing rules (no unsourced measurements stored)",
    category: "provenance",
    method:
      "Every PLACEHOLDER must have a null value; SOURCED requires an https URL and Operator verification; DERIVED requires a stated derivation. " +
      "Calculations must be unable to read a PLACEHOLDER (requireUsableValue must throw).",
    run: () => {
      const v = materialRuleViolations(HOLMIUM);
      const ph = HOLMIUM.properties.find((p) => p.status === "PLACEHOLDER");
      let guarded = false;
      try { if (ph) requireUsableValue(ph); } catch (e) { guarded = e instanceof PlaceholderValueError; }
      const ok = v.length === 0 && guarded;
      return {
        status: ok ? "PASSED" : "FAILED",
        detail: `${v.length} rule violations${v.length ? `: ${v.join("; ")}` : ""}; placeholder read blocked: ${guarded}.`,
        measured: { violations: v.length },
      };
    },
  },
  {
    id: "prov.sourced-data",
    title: "Scientific values are backed by Operator-verified sources",
    category: "provenance",
    method:
      "Count holmium properties by status and reference-registry citations by status. PASSED only if every empirical holmium " +
      "property is SOURCED and every reference is OPERATOR_VERIFIED; FAILED if any reference has no source at all; otherwise INCONCLUSIVE.",
    run: () => {
      const props = HOLMIUM.properties;
      const count = (s: string) => props.filter((p) => p.status === s).length;
      const sourced = count("SOURCED"), placeholders = count("PLACEHOLDER"), derived = count("DERIVED"), defs = count("DEFINITION");
      const refVerified = REGISTRY.filter((r) => r.citation.status === "OPERATOR_VERIFIED").length;
      const refNone = REGISTRY.filter((r) => r.citation.status === "NONE");
      const allGood = placeholders === 0 && refVerified === REGISTRY.length;
      const status: ValidationStatus = refNone.length > 0 ? "FAILED" : allGood ? "PASSED" : "INCONCLUSIVE";
      return {
        status,
        detail: `Holmium: ${sourced} sourced, ${placeholders} placeholders, ${derived} derived, ${defs} definitional. ` +
          `References: ${refVerified}/${REGISTRY.length} Operator-verified, ${refNone.length} with no source` +
          (refNone.length ? ` (${refNone.map((r) => r.id).join(", ")})` : "") + ".",
        measured: { sourced, placeholders, derived, definitional: defs, referencesVerified: refVerified, referencesNoSource: refNone.length },
      };
    },
  },
  {
    id: "orion.contract-enforcement",
    title: "ORION cannot self-validate or promote hypotheses",
    category: "integrity",
    method: "Submit forbidden outputs to the ORION admission guard: ESTABLISHED_LAW class, status PASSED, forbidden action kinds, waived validation. All must be rejected; one well-formed proposal must be admitted.",
    run: () => {
      const good = { kind: "explain-equation", evidenceClass: "UNVERIFIED_AI_EXPLANATION", content: "x", references: [] };
      const attempts = [
        { ...good, evidenceClass: "ESTABLISHED_LAW" },
        { ...good, evidenceClass: "EMPIRICAL_MEASUREMENT" },
        { ...good, status: "PASSED" },
        { ...good, requiresValidation: false },
        { ...good, kind: "declare-validated" },
        { ...good, kind: "promote-hypothesis-to-fact" },
        { ...good, kind: "execute-external-action" },
      ];
      const rejected = attempts.filter((a) => { try { admitOrionProposal(a); return false; } catch (e) { return e instanceof OrionContractViolation; } }).length;
      let admitted = false;
      try { admitted = admitOrionProposal(good).requiresValidation === true; } catch { admitted = false; }
      return { status: rejected === attempts.length && admitted ? "PASSED" : "FAILED", detail: `${rejected}/${attempts.length} forbidden outputs rejected; well-formed proposal admitted: ${admitted}.` };
    },
  },
  {
    id: "integrity.ledger-tamper-evidence",
    title: "Ledger detects altered, reordered and forged entries",
    category: "integrity",
    method: "Append 3 entries, verify; then verify (a) a payload-altered copy, (b) a reordered copy, (c) a copy whose hash was recomputed for a changed entry without re-linking. Each must be detected.",
    run: () => {
      const L = new EvidenceLedger(() => new Date(0));
      L.append("operator", "operator-note", { text: "a" });
      L.append("engine", "simulation", { x: 1 });
      L.append("crucible", "validation", { id: "t", status: "PASSED" });
      const good = L.verify().ok;
      const es = L.entries().map((e) => JSON.parse(JSON.stringify(e)) as LedgerEntry);
      const altered = es.map((e, i) => (i === 1 ? { ...e, payload: { x: 2 } } : e));
      const reordered = [es[0]!, es[2]!, es[1]!];
      const forgedBody = { ...es[1]!, payload: { x: 2 } };
      const { hash: _h, ...fb } = forgedBody;
      const forged = [es[0]!, { ...forgedBody, hash: sha256Hex(canonicalJSON(fb)) }, es[2]!];
      const d = [verifyChain(altered), verifyChain(reordered), verifyChain(forged)].map((r) => !r.ok);
      const ok = good && d.every(Boolean);
      return {
        status: ok ? "PASSED" : "FAILED",
        detail: `intact chain verifies: ${good}; altered detected: ${d[0]}; reordered detected: ${d[1]}; re-hashed forgery detected: ${d[2]}. ` +
          "Tamper-evident only — whole-chain rewrite is undetectable without external anchoring (not implemented).",
      };
    },
  },
  {
    id: "orion.inference-engine",
    title: "Scientific evaluation of ORION language-model output",
    category: "falsification",
    method: "Not built. Model output passes a contract guard (class, status, forbidden actions) and numerical statements are flagged, but nothing checks whether its science is correct.",
  },
  {
    id: "hyp.shaftless-suspension",
    title: "Shaftless-disk suspension stability analysis",
    category: "falsification",
    method: "Not built. Requires a specified suspension mechanism, field-gradient (force) model and stability analysis. No feasibility is claimed.",
  },
  {
    id: "ho.material-model",
    title: "Holmium magnetic material model (anisotropy, temperature dependence)",
    category: "falsification",
    method: "Not built in Phase 001. Requires cited empirical data the Operator has verified.",
  },
  {
    id: "cryo.thermal-constraints",
    title: "Cryogenic thermal constraints",
    category: "initial-boundary",
    method: "Not built in Phase 001. Requires a thermal model and cited material data.",
  },
  {
    id: "integrity.ledger-persistence",
    title: "Durable ledger persistence",
    category: "integrity",
    method: "Not built in Phase 001: the ledger is in-memory only.",
  },
];

// ── Runner ──────────────────────────────────────────────────────────────────

function execute(def: CheckDef, now: () => Date): CheckResult {
  const base = { schema: SCHEMA.check, id: def.id, title: def.title, category: def.category, method: def.method };
  if (!def.run) {
    return { ...base, status: "NOT IMPLEMENTED", detail: "No check exists yet.", measured: {}, executedAt: null, durationMs: null };
  }
  const executedAt = now().toISOString();
  const t0 = performance.now();
  try {
    const o = def.run();
    // Non-finite measurements cannot be recorded canonically; keep them visible in the detail instead.
    const measured: Record<string, number> = {};
    const nonFinite: string[] = [];
    for (const [k, v] of Object.entries(o.measured ?? {})) (Number.isFinite(v) ? (measured[k] = v) : nonFinite.push(`${k}=${v}`));
    const detail = nonFinite.length ? `${o.detail} [non-finite measurements: ${nonFinite.join(", ")}]` : o.detail;
    return { ...base, status: o.status, detail, measured, executedAt, durationMs: performance.now() - t0 };
  } catch (err) {
    return { ...base, status: "FAILED", detail: `Check threw: ${(err as Error).message}`, measured: {}, executedAt, durationMs: performance.now() - t0 };
  }
}

function describeRuntime(): string {
  const p = (globalThis as { process?: { versions?: { node?: string } } }).process;
  if (p?.versions?.node) return `node v${p.versions.node}`;
  const nav = (globalThis as { navigator?: { userAgent?: string } }).navigator;
  return nav?.userAgent ? `browser (${nav.userAgent.slice(0, 80)})` : "unknown runtime";
}

export const CHECK_IDS = checks.map((c) => c.id);

export function runCrucible(opts: { now?: () => Date; only?: string[] } = {}): CrucibleReport {
  const now = opts.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const results = checks.filter((c) => !opts.only || opts.only.includes(c.id)).map((c) => execute(c, now));
  const summary = Object.fromEntries(VALIDATION_STATUSES.map((s) => [s, 0])) as Record<ValidationStatus, number>;
  for (const r of results) summary[r.status]++;
  return { softwareVersion: LAB_VERSION, runtime: describeRuntime(), startedAt, checks: results, summary };
}

/** Record a report: one ledger entry per check, written as the Crucible. */
export function recordReport(ledger: EvidenceLedger, report: CrucibleReport): void {
  for (const c of report.checks) {
    ledger.append("crucible", "validation", { ...c, runtime: report.runtime });
  }
}
