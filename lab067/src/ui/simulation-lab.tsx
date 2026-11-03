"use client";
import { useState } from "react";
import { MAX_STEPS, simulate, type RigidBodyParams, type SimulationRecord } from "../integration/rigid-body.ts";
import { bodyAxisInWorld, dipoleEnergySeries, polarAngle, unwrappedAzimuth } from "../integration/observables.ts";
import { fromAxisAngle } from "../physics/quaternion.ts";
import { fastTopEpsilon, fastTopPrecessionRate } from "../physics/magnetic.ts";
import { norm, type Vec3 } from "../physics/vec3.ts";
import {
  assessMagneticConservation, assessTorqueFreeConservation, parseNumericField, validateMagneticSimulationInputs,
  validateSimulationInputs, type ConservationAssessment,
} from "../crucible/validators.ts";
import type { LedgerEntry } from "../ledger/ledger.ts";
import { LineChart } from "./line-chart.tsx";
import { StatusBadge } from "./status-badge.tsx";
import { fmt } from "./format.ts";
import { RecordedNote, useLedger } from "./ledger-context.tsx";
import { VecFields, type Triple } from "./vec-fields.tsx";

type Model = "free" | "dipole";
interface Preset { name: string; model: Model; I: Triple; w: Triple; T: string; dt: string; m?: Triple; B?: Triple; tilt?: string }
const PRESETS: Preset[] = [
  { name: "Symmetric disk precession", model: "free", I: ["1", "1", "2"], w: ["0.1", "0", "10"], T: "10", dt: "0.001" },
  { name: "Intermediate-axis flip", model: "free", I: ["1", "2", "3"], w: ["0.001", "1", "0.001"], T: "40", dt: "0.005" },
  { name: "Stable major-axis spin", model: "free", I: ["1", "2", "3"], w: ["0.001", "0.001", "1"], T: "40", dt: "0.005" },
  { name: "Coarse step (shows error)", model: "free", I: ["1", "2", "3"], w: ["0.3", "3", "0.5"], T: "20", dt: "0.05" },
  { name: "Magnetic precession (fast spin)", model: "dipole", I: ["0.02", "0.02", "0.04"], w: ["0", "0", "20"], T: "60", dt: "0.002", m: ["0", "0", "1"], B: ["0", "0", "0.1"], tilt: "0.5" },
  { name: "Slow spin: strong nutation", model: "dipole", I: ["0.02", "0.02", "0.04"], w: ["0", "0", "3"], T: "30", dt: "0.002", m: ["0", "0", "1"], B: ["0", "0", "0.1"], tilt: "0.5" },
  { name: "Dipole oscillation (no spin)", model: "dipole", I: ["0.02", "0.02", "0.04"], w: ["0", "0", "0"], T: "20", dt: "0.002", m: ["0", "0", "1"], B: ["0", "0", "0.1"], tilt: "0.5" },
];
const TARGET_SAMPLES = 800;

interface Precession { measured: number; theory: number | null; eps: number | null; applicable: string | null }
interface Result {
  model: Model;
  rec: SimulationRecord;
  assess: ConservationAssessment[];
  refinement: { omegaDiff: number; estimatedError: number } | null;
  wallMs: number;
  warnings: string[];
  tolerance: number;
  precession: Precession | null;
}

function precessionAnalysis(rec: SimulationRecord): { phi: number[]; theta: number[]; summary: Precession } | null {
  const { inertia: I, magneticMomentBody: m, fieldWorld: B } = rec.params;
  if (norm(B) === 0) return null;
  const axis = bodyAxisInWorld(rec.samples, [0, 0, 1]);
  const phi = unwrappedAzimuth(axis, B);
  const theta = polarAngle(axis, B);
  const T = rec.samples.at(-1)!.t;
  const measured = phi.at(-1)! / T;
  const w3 = rec.initial.omega[2];
  let applicable: string | null = null;
  if (Math.abs(I[0] - I[1]) > 1e-12 * I[0]) applicable = "body is not axisymmetric (I₁ ≠ I₂)";
  else if (Math.hypot(m[0], m[1]) > 1e-12 * norm(m) || m[2] === 0) applicable = "m is not along the symmetry axis (body 3)";
  else if (w3 === 0) applicable = "no spin (ω₃ = 0)";
  if (applicable) return { phi, theta, summary: { measured, theory: null, eps: null, applicable } };
  // Signed m₃: m along +e₃ precesses at −|m||B|/(I₃ω₃) about +B̂; m along −e₃ reverses the sense.
  const theory = fastTopPrecessionRate(m[2], norm(B), I[2], w3);
  const eps = fastTopEpsilon(I[0], I[2], Math.abs(m[2]), norm(B), w3);
  return { phi, theta, summary: { measured, theory, eps, applicable: eps > 0.1 ? `ε = ${eps.toFixed(2)} is not small: the fast-top approximation does not apply` : null } };
}

export function SimulationLab() {
  const [model, setModel] = useState<Model>("free");
  const [I, setI] = useState<Triple>(PRESETS[0]!.I);
  const [w, setW] = useState<Triple>(PRESETS[0]!.w);
  const [m, setM] = useState<Triple>(["0", "0", "1"]);
  const [B, setB] = useState<Triple>(["0", "0", "0.1"]);
  const [tilt, setTilt] = useState("0.5");
  const [T, setT] = useState(PRESETS[0]!.T);
  const [dt, setDt] = useState(PRESETS[0]!.dt);
  const [tol, setTol] = useState("1e-6");
  const [errors, setErrors] = useState<string[]>([]);
  const [res, setRes] = useState<Result | null>(null);
  const [recorded, setRecorded] = useState<LedgerEntry[] | null>(null);
  const { append } = useLedger();

  const applyPreset = (p: Preset) => {
    setModel(p.model); setI(p.I); setW(p.w); setT(p.T); setDt(p.dt);
    if (p.m) setM(p.m); if (p.B) setB(p.B); if (p.tilt) setTilt(p.tilt);
    setRes(null); setErrors([]); setRecorded(null);
  };

  const run = () => {
    setRecorded(null);
    const tolF = parseNumericField(tol, "tolerance");
    const tolErr = tolF.ok ? (tolF.value > 0 ? [] : ["tolerance must be > 0"]) : [tolF.error];
    let params: RigidBodyParams, omega: Vec3, steps: number, h: number, q0 = fromAxisAngle([1, 0, 0], 0), warnings: string[];
    if (model === "dipole") {
      const v = validateMagneticSimulationInputs({ inertia: I, omega: w, duration: T, dt, momentBody: m, fieldWorld: B, tilt });
      setErrors([...v.errors, ...tolErr]);
      if (!v.value || tolErr.length) { setRes(null); return; }
      params = { inertia: v.value.inertia, magneticMomentBody: v.value.momentBody, fieldWorld: v.value.fieldWorld };
      ({ omega, steps, dt: h } = v.value); q0 = fromAxisAngle([1, 0, 0], v.value.tilt); warnings = v.warnings;
    } else {
      const v = validateSimulationInputs({ inertia: I, omega: w, duration: T, dt });
      setErrors([...v.errors, ...tolErr]);
      if (!v.value || tolErr.length) { setRes(null); return; }
      params = { inertia: v.value.inertia, magneticMomentBody: [0, 0, 0], fieldWorld: [0, 0, 0] };
      ({ omega, steps, dt: h } = v.value); warnings = v.warnings;
    }
    const tolerance = (tolF as { value: number }).value;
    const t0 = performance.now();
    const rec = simulate(params, { q: q0, omega }, { dt: h, steps, sampleEvery: Math.max(1, Math.ceil(steps / TARGET_SAMPLES)), renormalise: true });
    let refinement: Result["refinement"] = null;
    if (steps * 2 <= MAX_STEPS) {
      const fine = simulate(params, { q: q0, omega }, { dt: h / 2, steps: steps * 2, sampleEvery: steps * 2, renormalise: true });
      const a = rec.samples.at(-1)!.omega, b = fine.samples.at(-1)!.omega;
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      refinement = { omegaDiff: d, estimatedError: (d * 16) / 15 };
    }
    const assess = model === "dipole" ? assessMagneticConservation(rec, tolerance) : assessTorqueFreeConservation(rec, tolerance);
    const precession = model === "dipole" ? precessionAnalysis(rec)?.summary ?? null : null;
    setRes({ model, rec, assess, refinement, wallMs: performance.now() - t0, warnings, tolerance, precession });
  };

  const record = () => {
    if (!res) return;
    const { rec } = res;
    const last = rec.samples.at(-1)!;
    const sim = append("engine", "simulation", {
      kind: res.model === "dipole" ? "rigid body + fixed dipole in uniform B" : "torque-free rigid body",
      integrator: rec.integrator, softwareVersion: rec.softwareVersion,
      assumptions: rec.assumptions, params: rec.params, initial: rec.initial, config: rec.config,
      summary: { samples: rec.samples.length, finalTime: last.t, finalOmega: last.omega, finalTotalEnergy: last.energy, finalKineticEnergy: last.kineticEnergy, finalAngularMomentumMagnitude: last.angularMomentumMagnitude },
      stepHalvingEstimate: res.refinement, precession: res.precession,
    });
    const val = append("crucible", "validation", { checks: res.assess, tolerance: res.tolerance, appliesTo: sim.hash });
    setRecorded([sim, val]);
  };

  const s = res?.rec.samples ?? [];
  const tAxis = s.map((x) => x.t);
  const pa = res?.model === "dipole" ? precessionAnalysis(res.rec) : null;
  const U = res?.model === "dipole" ? dipoleEnergySeries(s, res.rec.params.magneticMomentBody, res.rec.params.fieldWorld) : [];
  const T0 = s[0]?.kineticEnergy ?? 0, L0 = s[0]?.angularMomentumMagnitude ?? 0, E0 = s[0]?.energy ?? 0;
  const Bv = res?.rec.params.fieldWorld ?? [0, 0, 1];
  const Bn = norm(Bv) || 1;
  const LB = s.map((x) => (x.angularMomentumWorld[0] * Bv[0] + x.angularMomentumWorld[1] * Bv[1] + x.angularMomentumWorld[2] * Bv[2]) / Bn);
  const eScale = Math.max(Math.abs(E0), T0, 1e-300);

  return (
    <>
      <fieldset>
        <legend>Torque model</legend>
        <div className="row">
          <label className="row" style={{ gap: 6 }}><input type="radio" name="tm" checked={model === "free"} onChange={() => { setModel("free"); setRes(null); }} /> Torque-free (τ = 0)</label>
          <label className="row" style={{ gap: 6 }}><input type="radio" name="tm" checked={model === "dipole"} onChange={() => { setModel("dipole"); setRes(null); }} /> Fixed dipole in uniform field (τ = m × B)</label>
        </div>
      </fieldset>
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="small muted">Presets:</span>
        {PRESETS.filter((p) => p.model === model).map((p) => <button key={p.name} className="btn" onClick={() => applyPreset(p)}>{p.name}</button>)}
      </div>
      <div className="grid grid-2">
        <div>
          <VecFields legend="Principal moments of inertia" symbol="I" unit="kg·m²" value={I} onChange={setI} />
          <VecFields legend="Initial angular velocity ω(0), body frame" symbol="ω" unit="rad/s" value={w} onChange={setW} />
          {model === "dipole" && (
            <>
              <VecFields legend="Magnetic moment m, body frame (fixed in body)" symbol="m" unit="A·m²" value={m} onChange={setM} />
              <VecFields legend="Uniform external field B, world frame" symbol="B" unit="T" value={B} onChange={setB} />
            </>
          )}
        </div>
        <div>
          <fieldset>
            <legend>Integration</legend>
            <div className="fields">
              <label className="field"><span>Duration <span className="unit">[s]</span></span><input inputMode="decimal" value={T} onChange={(e) => setT(e.target.value)} /></label>
              <label className="field"><span>Time step Δt <span className="unit">[s]</span></span><input inputMode="decimal" value={dt} onChange={(e) => setDt(e.target.value)} /></label>
              <label className="field"><span>Conservation tolerance <span className="unit">[relative]</span></span><input inputMode="decimal" value={tol} onChange={(e) => setTol(e.target.value)} /></label>
              {model === "dipole" && <label className="field"><span>Initial tilt about body x <span className="unit">[rad]</span></span><input inputMode="decimal" value={tilt} onChange={(e) => setTilt(e.target.value)} /></label>}
            </div>
            <p className="small muted" style={{ marginBottom: 0 }}>
              Method: classical RK4, fixed step. {model === "dipole" ? "Initial attitude: rotated by the tilt about body x, so body axis 3 starts tilted from world z." : "τ = 0. Initial attitude = identity."} Max {MAX_STEPS.toLocaleString()} steps.
            </p>
          </fieldset>
          <div className="row">
            <button className="btn primary" onClick={run}>Run simulation</button>
            {res && <button className="btn" onClick={record}>Record to Evidence Ledger</button>}
          </div>
          <div style={{ marginTop: 6 }}><RecordedNote entries={recorded} /></div>
          {errors.length > 0 && <ul className="errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          {res && res.warnings.length > 0 && <ul className="warnings">{res.warnings.map((e) => <li key={e}>{e}</li>)}</ul>}
        </div>
      </div>

      {res && (
        <>
          <h2>Conservation checks (Crucible)</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Status</th><th>Quantity</th><th className="num">Max relative error</th><th className="num">Tolerance</th><th>Note</th></tr></thead>
              <tbody>
                {res.assess.map((a) => (
                  <tr key={a.check}><td><StatusBadge status={a.status} /></td><td>{a.quantity}</td><td className="num">{fmt(a.maxRelativeError, 3)}</td><td className="num">{a.check.startsWith("control") ? "—" : fmt(a.tolerance, 2)}</td><td className="small">{a.note}</td></tr>
                ))}
                <tr>
                  <td><span className="tag">ESTIMATE</span></td><td>Truncation error in ω(T) (step halving)</td>
                  <td className="num">{res.refinement ? `${fmt(res.refinement.estimatedError, 3)} rad/s` : "—"}</td><td className="num">—</td>
                  <td className="small">{res.refinement ? `|ω_Δt − ω_Δt/2| = ${fmt(res.refinement.omegaDiff, 3)} rad/s; × 16/15 for RK4. An estimate, not a bound.` : "Skipped: halved run would exceed the step cap."}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="small muted">{res.rec.config.steps.toLocaleString()} steps, {s.length} samples plotted, {res.wallMs.toFixed(0)} ms in this browser (includes the Δt/2 run).</p>

          {res.precession && (
            <>
              <h2>Precession about B</h2>
              <div className="panel">
                <dl className="kv">
                  <dt>Measured mean precession rate</dt><dd>{fmt(res.precession.measured, 6)} rad/s <span className="muted">(net azimuth of body axis 3 about B̂ ÷ duration)</span></dd>
                  <dt>Gyroscopic approximation</dt><dd>{res.precession.theory === null ? "not applicable" : `${fmt(res.precession.theory, 6)} rad/s  = −m₃|B| / (I₃ω₃)`}</dd>
                  <dt>Relative deviation</dt><dd>{res.precession.theory === null ? "—" : fmt(Math.abs(res.precession.measured - res.precession.theory) / Math.abs(res.precession.theory), 3)}</dd>
                  <dt>Small parameter ε</dt><dd>{res.precession.eps === null ? "—" : `${fmt(res.precession.eps, 3)}  = I⊥|m||B| / (I₃ω₃)²  (deviation expected ~ε)`}</dd>
                </dl>
                {res.precession.applicable && <p className="small" style={{ color: "var(--inc)", marginBottom: 0 }}>Approximation caveat: {res.precession.applicable}.</p>}
                <p className="small muted" style={{ marginBottom: 0 }}>The measured rate includes any partial nutation cycle at the end of the run; longer runs average it out. Crucible check <span className="mono">analytic.fast-top-precession</span> tests this relationship systematically.</p>
              </div>
            </>
          )}

          <h2>Results</h2>
          <div className="panel" style={{ marginBottom: 14 }}>
            <LineChart title="Angular velocity components (body frame)" x={tAxis} xLabel="t [s]" yLabel="ω [rad/s]"
              series={[0, 1, 2].map((i) => ({ name: `ω${"₁₂₃"[i]}`, color: `var(--series-${i + 1})`, values: s.map((x) => x.omega[i]!) }))} />
          </div>
          {res.model === "dipole" ? (
            <div className="grid">
              <div className="panel"><LineChart title="Energy exchange relative to t = 0: ΔT, ΔU = Δ(−m·B), ΔE" x={tAxis} xLabel="t [s]" yLabel="Δ energy [J]" height={220}
                series={[
                  { name: "ΔT", color: "var(--series-1)", values: s.map((x) => x.kineticEnergy - T0) },
                  { name: "ΔU", color: "var(--series-2)", values: U.map((u) => u - (U[0] ?? 0)) },
                  { name: "ΔE", color: "var(--series-3)", values: s.map((x) => x.energy - E0) },
                ]} note={`Kinetic and potential energy trade off (ΔT = −ΔU) while ΔE stays at zero. At t = 0: T₀ = ${fmt(T0, 6)} J, U₀ = ${fmt(U[0] ?? 0, 6)} J.`} /></div>
              {pa && <div className="panel"><LineChart title="Precession angle φ of body axis 3 about B̂" x={tAxis} xLabel="t [s]" yLabel="φ [rad]" height={200}
                series={[{ name: "φ", color: "var(--series-1)", values: pa.phi }]} /></div>}
              {pa && <div className="panel"><LineChart title="Nutation: angle θ between body axis 3 and B̂" x={tAxis} xLabel="t [s]" yLabel="θ [rad]" height={200}
                series={[{ name: "θ", color: "var(--series-1)", values: pa.theta }]} /></div>}
            </div>
          ) : (
            <div className="grid">
              <div className="panel"><LineChart title="Rotational kinetic energy T" x={tAxis} xLabel="t [s]" yLabel="T [J]" height={200}
                series={[{ name: "T", color: "var(--series-1)", values: s.map((x) => x.kineticEnergy) }]} /></div>
              <div className="panel"><LineChart title="Angular momentum magnitude |L|" x={tAxis} xLabel="t [s]" yLabel="|L| [kg·m²/s]" height={200}
                series={[{ name: "|L|", color: "var(--series-1)", values: s.map((x) => x.angularMomentumMagnitude) }]} /></div>
            </div>
          )}
          <div className="panel" style={{ marginTop: 14 }}>
            {res.model === "dipole" ? (
              <LineChart title="Conservation error of the true invariants" x={tAxis} xLabel="t [s]" yLabel="|relative error|" scale="log"
                series={[
                  { name: "|E − E₀| / max(|E₀|, T₀)", color: "var(--series-1)", values: s.map((x) => Math.abs(x.energy - E0) / eScale) },
                  { name: "|L·B̂ − (L·B̂)₀| / |L₀|", color: "var(--series-2)", values: LB.map((v) => (L0 ? Math.abs(v - LB[0]!) / L0 : 0)) },
                ]}
                note="Log scale. Values at 1e-17 are exact zeros or below double-precision resolution." />
            ) : (
              <LineChart title="Conservation error (should be zero for exact arithmetic)" x={tAxis} xLabel="t [s]" yLabel="|relative error|" scale="log"
                series={[
                  { name: "|T − T₀|/T₀", color: "var(--series-1)", values: s.map((x) => (T0 ? Math.abs(x.kineticEnergy - T0) / T0 : 0)) },
                  { name: "||L| − |L₀||/|L₀|", color: "var(--series-2)", values: s.map((x) => (L0 ? Math.abs(x.angularMomentumMagnitude - L0) / L0 : 0)) },
                ]}
                note="Log scale. Values at 1e-17 are exact zeros or below double-precision resolution (≈1.1e-16 relative)." />
            )}
          </div>
        </>
      )}
    </>
  );
}
