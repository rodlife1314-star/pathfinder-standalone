/**
 * Crucible input and output validators. Deliberately separate from the
 * physics and integration engines: the engines compute, these judge.
 * Every function is pure and deterministic.
 */
import type { ValidationStatus } from "../contracts/evidence.ts";
import { checkPrincipalInertia } from "../physics/inertia.ts";
import { dot, norm, type Vec3 } from "../physics/vec3.ts";
import { MAX_STEPS, type SimulationRecord } from "../integration/rigid-body.ts";

export type FieldResult = { ok: true; value: number } | { ok: false; error: string };

/**
 * Strict numeric parsing for user-typed text. Rejects what Number() silently
 * accepts: "" → 0, "  " → 0, "0x10" → 16, "Infinity", and overflow to ±Infinity.
 */
export function parseNumericField(raw: string, label: string): FieldResult {
  const s = raw.trim();
  if (s === "") return { ok: false, error: `${label}: value required` };
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return { ok: false, error: `${label}: "${raw}" is not a decimal number` };
  const v = Number(s);
  if (!Number.isFinite(v)) return { ok: false, error: `${label}: magnitude overflows double precision` };
  return { ok: true, value: v };
}

export interface ValidationOutcome<T> {
  status: Extract<ValidationStatus, "PASSED" | "FAILED">;
  value: T | null;
  errors: string[];
  warnings: string[];
}

function parseVec(raw: readonly [string, string, string], label: string, errors: string[]): Vec3 | null {
  const r = raw.map((s, i) => parseNumericField(s, `${label}${i + 1}`));
  const vals: number[] = [];
  for (const f of r) f.ok ? vals.push(f.value) : errors.push(f.error);
  return vals.length === 3 ? (vals as unknown as Vec3) : null;
}

export interface EulerInputs { inertia: Vec3; omega: Vec3; torque: Vec3 }
export interface EulerRawInputs {
  inertia: readonly [string, string, string];
  omega: readonly [string, string, string];
  torque: readonly [string, string, string];
}

export function validateEulerInputs(raw: EulerRawInputs): ValidationOutcome<EulerInputs> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const inertia = parseVec(raw.inertia, "I", errors);
  const omega = parseVec(raw.omega, "ω", errors);
  const torque = parseVec(raw.torque, "τ", errors);
  if (inertia) errors.push(...checkPrincipalInertia(inertia).reasons);
  if (inertia && omega && torque && errors.length === 0) {
    const [a, b, c] = inertia;
    if (Math.abs(a + b - c) < 1e-12 * (a + b + c) || Math.abs(b + c - a) < 1e-12 * (a + b + c) || Math.abs(a + c - b) < 1e-12 * (a + b + c)) {
      warnings.push("Inertia sits exactly on a triangle-inequality limit: a perfectly flat (planar) body.");
    }
    const big = [...inertia, ...omega, ...torque].some((x) => x !== 0 && (Math.abs(x) > 1e150 || Math.abs(x) < 1e-150));
    if (big) warnings.push("Values span an extreme magnitude range; products may overflow or underflow.");
    return { status: "PASSED", value: { inertia, omega, torque }, errors, warnings };
  }
  return { status: "FAILED", value: null, errors, warnings };
}

export interface SimRawInputs {
  inertia: readonly [string, string, string];
  omega: readonly [string, string, string];
  duration: string;
  dt: string;
}
export interface SimInputs { inertia: Vec3; omega: Vec3; duration: number; dt: number; steps: number }

export function validateSimulationInputs(raw: SimRawInputs): ValidationOutcome<SimInputs> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const inertia = parseVec(raw.inertia, "I", errors);
  const omega = parseVec(raw.omega, "ω₀", errors);
  const T = parseNumericField(raw.duration, "duration");
  const h = parseNumericField(raw.dt, "Δt");
  if (!T.ok) errors.push(T.error); else if (!(T.value > 0)) errors.push("duration must be > 0 s");
  if (!h.ok) errors.push(h.error); else if (!(h.value > 0)) errors.push("Δt must be > 0 s");
  if (inertia) errors.push(...checkPrincipalInertia(inertia).reasons);
  let steps = 0;
  if (T.ok && h.ok && T.value > 0 && h.value > 0) {
    steps = Math.round(T.value / h.value);
    if (steps < 1) errors.push("duration is shorter than one time step");
    if (steps > MAX_STEPS) errors.push(`duration / Δt = ${steps} steps exceeds the cap of ${MAX_STEPS}`);
    if (Math.abs(steps * h.value - T.value) > 1e-9 * T.value) warnings.push(`duration is not a whole number of steps; simulating ${steps} steps = ${(steps * h.value).toPrecision(6)} s`);
  }
  if (inertia && omega && h.ok && errors.length === 0) {
    // Heuristic accuracy guard: fastest body-frame rate ~ |ω| · max(I)/min(I).
    const wmax = Math.hypot(...omega) * Math.max(...inertia) / Math.min(...inertia);
    const phase = wmax * h.value;
    if (phase > 0.5) errors.push(`Δt too large: estimated fastest rotation advances ${phase.toFixed(2)} rad per step (limit 0.5). Results would be meaningless.`);
    else if (phase > 0.1) warnings.push(`Δt is coarse: ~${phase.toFixed(2)} rad per step. Expect visible conservation error.`);
  }
  if (errors.length || !inertia || !omega || !T.ok || !h.ok) return { status: "FAILED", value: null, errors, warnings };
  return { status: "PASSED", value: { inertia, omega, duration: steps * h.value, dt: h.value, steps }, errors, warnings };
}

export interface ConservationAssessment {
  check: string;
  quantity: string;
  status: ValidationStatus;
  maxRelativeError: number | null;
  tolerance: number;
  note: string;
}

/**
 * Judge conservation in a TORQUE-FREE run. Applies only when B = 0 or m = 0;
 * otherwise reports INCONCLUSIVE (the invariants differ — not judged here).
 */
export function assessTorqueFreeConservation(rec: SimulationRecord, tolerance = 1e-6): ConservationAssessment[] {
  const torqueFree = rec.params.fieldWorld.every((x) => x === 0) || rec.params.magneticMomentBody.every((x) => x === 0);
  const s = rec.samples;
  const rel = (vals: number[]): number | null => {
    const v0 = vals[0]!;
    if (v0 === 0) return null;
    return Math.max(...vals.map((v) => Math.abs(v - v0) / Math.abs(v0)));
  };
  const L0 = s[0]!.angularMomentumWorld;
  const L0n = Math.hypot(...L0);
  const lvec = L0n === 0 ? null : Math.max(...s.map((x) => Math.hypot(x.angularMomentumWorld[0] - L0[0], x.angularMomentumWorld[1] - L0[1], x.angularMomentumWorld[2] - L0[2]) / L0n));
  const judge = (check: string, quantity: string, e: number | null, note: string): ConservationAssessment => ({
    check, quantity, tolerance,
    maxRelativeError: e,
    status: !torqueFree ? "INCONCLUSIVE" : e === null ? "INCONCLUSIVE" : e <= tolerance ? "PASSED" : "FAILED",
    note: !torqueFree ? "Run has external torque; this invariant is not expected to hold." : e === null ? "Initial value is zero; relative error undefined." : note,
  });
  return [
    judge("cons.kinetic-energy", "Rotational kinetic energy T", rel(s.map((x) => x.kineticEnergy)), "Exact invariant of torque-free motion."),
    judge("cons.angular-momentum-magnitude", "|L|", rel(s.map((x) => x.angularMomentumMagnitude)), "Exact invariant; frame-independent."),
    judge("cons.angular-momentum-vector", "L (world frame)", lvec, "Exact invariant; also tests the attitude integration."),
  ];
}

export interface MagneticRawInputs extends SimRawInputs {
  momentBody: readonly [string, string, string];
  fieldWorld: readonly [string, string, string];
  tilt: string;
}
export interface MagneticInputs extends SimInputs { momentBody: Vec3; fieldWorld: Vec3; tilt: number }

/**
 * Validate a fixed-dipole / uniform-field run. Adds: finite m [A·m²], finite B [T],
 * tilt angle [rad] in [0, π]; and an accuracy guard on the field-driven time
 * scale √(|m||B| / I_min), which can be faster than the spin.
 */
export function validateMagneticSimulationInputs(raw: MagneticRawInputs): ValidationOutcome<MagneticInputs> {
  const base = validateSimulationInputs(raw);
  const errors = [...base.errors];
  const warnings = [...base.warnings];
  const m = parseVec(raw.momentBody, "m", errors);
  const B = parseVec(raw.fieldWorld, "B", errors);
  const tilt = parseNumericField(raw.tilt, "tilt");
  if (!tilt.ok) errors.push(tilt.error); else if (tilt.value < 0 || tilt.value > Math.PI) errors.push("tilt must be within [0, π] rad");
  if (m && B && base.value && errors.length === 0) {
    const mB = norm(m) * norm(B);
    if (mB === 0) warnings.push("|m||B| = 0: no magnetic torque; this is a torque-free run.");
    const wField = Math.sqrt(mB / Math.min(...base.value.inertia));
    const phase = wField * base.value.dt;
    if (phase > 0.5) errors.push(`Δt too large for the field-driven motion: ~${phase.toFixed(2)} rad per step (limit 0.5).`);
    else if (phase > 0.1) warnings.push(`Δt is coarse for the field-driven motion: ~${phase.toFixed(2)} rad per step.`);
    if (norm(B) > 50) warnings.push("|B| exceeds 50 T — beyond typical laboratory magnets; check units.");
  }
  if (errors.length || !base.value || !m || !B || !tilt.ok) return { status: "FAILED", value: null, errors, warnings };
  return { status: "PASSED", value: { ...base.value, momentBody: m, fieldWorld: B, tilt: tilt.value }, errors, warnings };
}

/**
 * Conservation for a fixed dipole in a uniform, static field:
 *   E = T − m·B  conserved;   L·B̂ conserved (τ = m × B ⟂ B).
 * |L| and T individually are NOT conserved — reported as INCONCLUSIVE controls.
 */
export function assessMagneticConservation(rec: SimulationRecord, tolerance = 1e-6): ConservationAssessment[] {
  const B = rec.params.fieldWorld;
  const Bn = norm(B);
  const s = rec.samples;
  const E = s.map((x) => x.energy);
  const scaleE = Math.max(Math.abs(E[0]!), Math.abs(s[0]!.kineticEnergy), 1e-300);
  const eErr = Math.max(...E.map((e) => Math.abs(e - E[0]!) / scaleE));
  const out: ConservationAssessment[] = [{
    check: "cons.total-energy", quantity: "Total energy E = T − m·B", tolerance, maxRelativeError: eErr,
    status: eErr <= tolerance ? "PASSED" : "FAILED",
    note: "Relative to max(|E₀|, T₀) so a near-zero E₀ does not inflate the error.",
  }];
  if (Bn === 0) {
    out.push({ check: "cons.L-dot-Bhat", quantity: "L·B̂", tolerance, maxRelativeError: null, status: "INCONCLUSIVE", note: "B = 0: no field direction." });
  } else {
    const Bh: Vec3 = [B[0] / Bn, B[1] / Bn, B[2] / Bn];
    const LB = s.map((x) => dot(x.angularMomentumWorld, Bh));
    // Reference scale: the largest |L| reached (|L₀| can be 0, e.g. a body released from rest).
    const Lmax = Math.max(...s.map((x) => x.angularMomentumMagnitude));
    const lbErr = Lmax > 0 ? Math.max(...LB.map((v) => Math.abs(v - LB[0]!) / Lmax)) : 0;
    out.push({ check: "cons.L-dot-Bhat", quantity: "L·B̂ (component along the field)", tolerance, maxRelativeError: lbErr,
      status: lbErr <= tolerance ? "PASSED" : "FAILED", note: "Exact invariant: torque m × B has no component along B. Relative to max |L| over the run." });
  }
  const lmag = s.map((x) => x.angularMomentumMagnitude);
  const L0 = lmag[0]!;
  const lChange = L0 > 0 ? Math.max(...lmag.map((v) => Math.abs(v - L0))) / L0 : null;
  out.push({ check: "control.L-magnitude", quantity: "|L| (control — not an invariant here)", tolerance, maxRelativeError: lChange,
    status: "INCONCLUSIVE",
    note: lChange === null
      ? `|L₀| = 0, so relative change is undefined; |L| reached ${Math.max(...lmag).toPrecision(4)} kg·m²/s. Expected to change when torque acts.`
      : "Expected to change when torque acts; shown so its variation is not mistaken for error." });
  return out;
}
