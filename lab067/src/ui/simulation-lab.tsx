"use client";
import { useState } from "react";
import { simulate, type SimulationRecord } from "../integration/rigid-body.ts";
import { IDENTITY } from "../physics/quaternion.ts";
import { assessTorqueFreeConservation, parseNumericField, validateSimulationInputs, type ConservationAssessment } from "../crucible/validators.ts";
import type { Vec3 } from "../physics/vec3.ts";
import type { LedgerEntry } from "../ledger/ledger.ts";
import { LineChart } from "./line-chart.tsx";
import { StatusBadge } from "./status-badge.tsx";
import { fmt } from "./format.ts";
import { RecordedNote, useLedger } from "./ledger-context.tsx";
import { VecFields, type Triple } from "./vec-fields.tsx";

const ZERO: Vec3 = [0, 0, 0];
const PRESETS: { name: string; I: Triple; w: Triple; T: string; dt: string }[] = [
  { name: "Symmetric disk precession", I: ["1", "1", "2"], w: ["0.1", "0", "10"], T: "10", dt: "0.001" },
  { name: "Intermediate-axis flip", I: ["1", "2", "3"], w: ["0.001", "1", "0.001"], T: "40", dt: "0.005" },
  { name: "Stable major-axis spin", I: ["1", "2", "3"], w: ["0.001", "0.001", "1"], T: "40", dt: "0.005" },
  { name: "Coarse step (shows error)", I: ["1", "2", "3"], w: ["0.3", "3", "0.5"], T: "20", dt: "0.05" },
];
const TARGET_SAMPLES = 800;

interface Result {
  rec: SimulationRecord;
  assess: ConservationAssessment[];
  refinement: { omegaDiff: number; estimatedError: number } | null;
  wallMs: number;
  warnings: string[];
  tolerance: number;
}

export function SimulationLab() {
  const [I, setI] = useState<Triple>(PRESETS[0]!.I);
  const [w, setW] = useState<Triple>(PRESETS[0]!.w);
  const [T, setT] = useState(PRESETS[0]!.T);
  const [dt, setDt] = useState(PRESETS[0]!.dt);
  const [tol, setTol] = useState("1e-6");
  const [errors, setErrors] = useState<string[]>([]);
  const [res, setRes] = useState<Result | null>(null);
  const [recorded, setRecorded] = useState<LedgerEntry[] | null>(null);
  const { append } = useLedger();

  const run = () => {
    setRecorded(null);
    const v = validateSimulationInputs({ inertia: I, omega: w, duration: T, dt });
    const tolF = parseNumericField(tol, "tolerance");
    const errs = [...v.errors, ...(tolF.ok ? (tolF.value > 0 ? [] : ["tolerance must be > 0"]) : [tolF.error])];
    setErrors(errs);
    if (!v.value || errs.length) { setRes(null); return; }
    const { inertia, omega, steps, dt: h } = v.value;
    const params = { inertia, magneticMomentBody: ZERO, fieldWorld: ZERO };
    const t0 = performance.now();
    const rec = simulate(params, { q: IDENTITY, omega }, { dt: h, steps, sampleEvery: Math.max(1, Math.ceil(steps / TARGET_SAMPLES)), renormalise: true });
    // Step-halving error estimate (Richardson, RK4): err(h) ≈ |ω_h − ω_{h/2}| · 16/15.
    let refinement: Result["refinement"] = null;
    if (steps * 2 <= 200_000) {
      const fine = simulate(params, { q: IDENTITY, omega }, { dt: h / 2, steps: steps * 2, sampleEvery: steps * 2, renormalise: true });
      const a = rec.samples.at(-1)!.omega, b = fine.samples.at(-1)!.omega;
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      refinement = { omegaDiff: d, estimatedError: (d * 16) / 15 };
    }
    setRes({ rec, assess: assessTorqueFreeConservation(rec, (tolF as { value: number }).value), refinement, wallMs: performance.now() - t0, warnings: v.warnings, tolerance: (tolF as { value: number }).value });
  };

  const record = () => {
    if (!res) return;
    const { rec } = res;
    const last = rec.samples.at(-1)!;
    const sim = append("engine", "simulation", {
      kind: "torque-free rigid body", integrator: rec.integrator, softwareVersion: rec.softwareVersion,
      assumptions: rec.assumptions, params: rec.params, initial: rec.initial, config: rec.config,
      summary: { samples: rec.samples.length, finalTime: last.t, finalOmega: last.omega, finalKineticEnergy: last.kineticEnergy, finalAngularMomentumMagnitude: last.angularMomentumMagnitude },
      stepHalvingEstimate: res.refinement,
    });
    const val = append("crucible", "validation", { checks: res.assess, tolerance: res.tolerance, appliesTo: sim.hash });
    setRecorded([sim, val]);
  };

  const s = res?.rec.samples ?? [];
  const tAxis = s.map((x) => x.t);
  const T0 = s[0]?.kineticEnergy ?? 0, L0 = s[0]?.angularMomentumMagnitude ?? 0;

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="small muted">Presets:</span>
        {PRESETS.map((p) => (
          <button key={p.name} className="btn" onClick={() => { setI(p.I); setW(p.w); setT(p.T); setDt(p.dt); setRes(null); setErrors([]); }}>{p.name}</button>
        ))}
      </div>
      <div className="grid grid-2">
        <div>
          <VecFields legend="Principal moments of inertia" symbol="I" unit="kg·m²" value={I} onChange={setI} />
          <VecFields legend="Initial angular velocity ω(0), body frame" symbol="ω" unit="rad/s" value={w} onChange={setW} />
        </div>
        <div>
          <fieldset>
            <legend>Integration</legend>
            <div className="fields">
              <label className="field"><span>Duration <span className="unit">[s]</span></span><input inputMode="decimal" value={T} onChange={(e) => setT(e.target.value)} /></label>
              <label className="field"><span>Time step Δt <span className="unit">[s]</span></span><input inputMode="decimal" value={dt} onChange={(e) => setDt(e.target.value)} /></label>
              <label className="field"><span>Conservation tolerance <span className="unit">[relative]</span></span><input inputMode="decimal" value={tol} onChange={(e) => setTol(e.target.value)} /></label>
            </div>
            <p className="small muted" style={{ marginBottom: 0 }}>Method: classical RK4, fixed step. τ = 0. Initial attitude = identity. Max 200 000 steps.</p>
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
              <thead><tr><th>Status</th><th>Invariant</th><th className="num">Max relative error</th><th className="num">Tolerance</th><th>Note</th></tr></thead>
              <tbody>
                {res.assess.map((a) => (
                  <tr key={a.check}><td><StatusBadge status={a.status} /></td><td>{a.quantity}</td><td className="num">{fmt(a.maxRelativeError, 3)}</td><td className="num">{fmt(a.tolerance, 2)}</td><td className="small">{a.note}</td></tr>
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

          <h2>Results</h2>
          <div className="panel" style={{ marginBottom: 14 }}>
            <LineChart title="Angular velocity components (body frame)" x={tAxis} xLabel="t [s]" yLabel="ω [rad/s]"
              series={[0, 1, 2].map((i) => ({ name: `ω${"₁₂₃"[i]}`, color: `var(--series-${i + 1})`, values: s.map((x) => x.omega[i]!) }))} />
          </div>
          <div className="grid">
            <div className="panel"><LineChart title="Rotational kinetic energy T" x={tAxis} xLabel="t [s]" yLabel="T [J]" height={200}
              series={[{ name: "T", color: "var(--series-1)", values: s.map((x) => x.kineticEnergy) }]} /></div>
            <div className="panel"><LineChart title="Angular momentum magnitude |L|" x={tAxis} xLabel="t [s]" yLabel="|L| [kg·m²/s]" height={200}
              series={[{ name: "|L|", color: "var(--series-1)", values: s.map((x) => x.angularMomentumMagnitude) }]} /></div>
          </div>
          <div className="panel" style={{ marginTop: 14 }}>
            <LineChart title="Conservation error (should be zero for exact arithmetic)" x={tAxis} xLabel="t [s]" yLabel="|relative error|" scale="log"
              series={[
                { name: "|T − T₀|/T₀", color: "var(--series-1)", values: s.map((x) => (T0 ? Math.abs(x.kineticEnergy - T0) / T0 : 0)) },
                { name: "||L| − |L₀||/|L₀|", color: "var(--series-2)", values: s.map((x) => (L0 ? Math.abs(x.angularMomentumMagnitude - L0) / L0 : 0)) },
              ]}
              note="Log scale. Values at 1e-17 are exact zeros or below double-precision resolution (≈1.1e-16 relative)." />
          </div>
        </>
      )}
    </>
  );
}
