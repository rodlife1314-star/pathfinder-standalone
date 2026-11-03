"use client";
import { Fragment, useMemo, useState } from "react";
import { eulerWorking } from "../physics/euler.ts";
import { solidCylinder } from "../physics/inertia.ts";
import { parseNumericField, validateEulerInputs } from "../crucible/validators.ts";
import type { LedgerEntry } from "../ledger/ledger.ts";
import { StatusBadge } from "./status-badge.tsx";
import { fmt } from "./format.ts";
import { RecordedNote, useLedger } from "./ledger-context.tsx";
import { VecFields, type Triple } from "./vec-fields.tsx";

const PRESETS: { name: string; I: Triple; w: Triple; t: Triple }[] = [
  { name: "Asymmetric body", I: ["1", "2", "3"], w: ["1", "1", "1"], t: ["0", "0", "0"] },
  { name: "Spin about axis 3", I: ["0.02", "0.03", "0.04"], w: ["0", "0", "50"], t: ["0", "0", "0"] },
  { name: "Wobbling disk", I: ["0.0025", "0.0025", "0.005"], w: ["0.4", "0", "30"], t: ["0", "0", "0"] },
  { name: "Torqued sphere", I: ["0.004", "0.004", "0.004"], w: ["0", "0", "10"], t: ["0.001", "0", "0"] },
];

const AXIS = [
  { d: "(I₃ − I₂)", p: "ω₂ω₃" },
  { d: "(I₁ − I₃)", p: "ω₃ω₁" },
  { d: "(I₂ − I₁)", p: "ω₁ω₂" },
];

export function EulerWorkbench() {
  const [I, setI] = useState<Triple>(PRESETS[0]!.I);
  const [w, setW] = useState<Triple>(PRESETS[0]!.w);
  const [t, setT] = useState<Triple>(PRESETS[0]!.t);
  const [geo, setGeo] = useState<Triple>(["1.0", "0.1", "0.01"]);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<LedgerEntry[] | null>(null);
  const { append } = useLedger();

  const v = useMemo(() => validateEulerInputs({ inertia: I, omega: w, torque: t }), [I, w, t]);
  const work = useMemo(() => (v.value ? eulerWorking(v.value.inertia, v.value.omega, v.value.torque) : null), [v]);
  const bad = (raw: Triple) => raw.map((s) => !parseNumericField(s, "").ok);
  const touch = <T,>(f: (x: T) => void) => (x: T) => { f(x); setRecorded(null); };

  const fromGeometry = () => {
    const [m, r, h] = geo.map((s, i) => parseNumericField(s, ["m", "r", "h"][i]!));
    const errs = [m, r, h].flatMap((f) => (f && !f.ok ? [f.error] : []));
    if (errs.length) return setGeoErr(errs.join("; "));
    try {
      const Ic = solidCylinder((m as { value: number }).value, (r as { value: number }).value, (h as { value: number }).value);
      setI(Ic.map((x) => String(Number(x.toPrecision(10)))) as Triple); setGeoErr(null); setRecorded(null);
    } catch (e) { setGeoErr((e as Error).message); }
  };

  const record = () => {
    const calc = append("engine", "calculation", {
      calculator: "euler-workbench", equationForm: "I_i ω̇_i = τ_i − (I_k − I_j) ω_j ω_k",
      inputsRaw: { inertia: I, omega: w, torque: t },
      inputsSI: v.value, outputs: work,
      units: { inertia: "kg·m²", omega: "rad/s", torque: "N·m", angularAcceleration: "rad/s²", angularMomentum: "kg·m²/s", kineticEnergy: "J" },
    });
    const val = append("crucible", "validation", {
      check: "inputs.euler-workbench", status: v.status, errors: v.errors, warnings: v.warnings, appliesTo: calc.hash,
    });
    setRecorded([calc, val]);
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="small muted">Presets:</span>
        {PRESETS.map((p) => (
          <button key={p.name} className="btn" onClick={() => { setI(p.I); setW(p.w); setT(p.t); setRecorded(null); }}>{p.name}</button>
        ))}
      </div>

      <div className="grid grid-2">
        <div>
          <VecFields legend="Principal moments of inertia" symbol="I" unit="kg·m²" value={I} onChange={touch(setI)} invalid={bad(I)} />
          <VecFields legend="Angular velocity (body frame)" symbol="ω" unit="rad/s" value={w} onChange={touch(setW)} invalid={bad(w)} />
          <VecFields legend="External torque (body frame)" symbol="τ" unit="N·m" value={t} onChange={touch(setT)} invalid={bad(t)} />
          <details className="panel" style={{ padding: 12 }}>
            <summary>Fill inertia from a solid disk / cylinder geometry</summary>
            <div className="fields" style={{ marginTop: 10 }}>
              {(["mass m [kg]", "radius r [m]", "thickness h [m]"] as const).map((lab, i) => (
                <label className="field" key={lab}>{lab}
                  <input inputMode="decimal" value={geo[i]} onChange={(e) => { const n = [...geo] as Triple; n[i] = e.target.value; setGeo(n); }} />
                </label>
              ))}
            </div>
            <p className="small muted">I₁ = I₂ = m(3r² + h²)/12, I₃ = ½mr² (homogeneous, symmetry axis = 3). Material-agnostic: no holmium density is used (it is a placeholder).</p>
            <button className="btn" onClick={fromGeometry}>Compute I₁, I₂, I₃</button>
            {geoErr && <ul className="errors"><li>{geoErr}</li></ul>}
          </details>
        </div>

        <div className="panel">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="eyebrow">Crucible input validation</span>
            <StatusBadge status={v.status} />
          </div>
          {v.errors.length > 0 && <ul className="errors">{v.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          {v.warnings.length > 0 && <ul className="warnings">{v.warnings.map((e) => <li key={e}>{e}</li>)}</ul>}
          {v.status === "PASSED" && v.warnings.length === 0 && <p className="small muted">All inputs are finite decimal numbers; moments are positive and satisfy I_i + I_j ≥ I_k.</p>}

          {work ? (
            <>
              <h3>Angular acceleration</h3>
              <dl className="kv">
                {work.axes.map((a) => (<Fragment key={a.axis}><dt>ω̇{"₁₂₃"[a.axis - 1]}</dt><dd>{fmt(a.angularAcceleration, 8)} rad/s²</dd></Fragment>))}
              </dl>
              <h3>Derived quantities</h3>
              <dl className="kv">
                <dt>L = Iω</dt><dd>({work.angularMomentumBody.map((x) => fmt(x, 6)).join(", ")}) kg·m²/s</dd>
                <dt>|L|</dt><dd>{fmt(work.angularMomentumMagnitude, 8)} kg·m²/s</dd>
                <dt>T = ½ω·Iω</dt><dd>{fmt(work.kineticEnergy, 8)} J</dd>
              </dl>
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn primary" onClick={record}>Record to Evidence Ledger</button>
                <RecordedNote entries={recorded} />
              </div>
            </>
          ) : (
            <p className="small" style={{ color: "var(--fail)" }}>No calculation performed: inputs rejected.</p>
          )}
        </div>
      </div>

      {work && (
        <>
          <h2>Working, axis by axis</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Axis</th><th>Equation</th><th className="num">I_k − I_j<br />[kg·m²]</th><th className="num">ω_jω_k<br />[rad²/s²]</th>
                  <th className="num">coupling<br />[N·m]</th><th className="num">τ_i<br />[N·m]</th><th className="num">τ_i − coupling<br />[N·m]</th><th className="num">÷ I_i<br />[kg·m²]</th><th className="num">ω̇_i<br />[rad/s²]</th></tr>
              </thead>
              <tbody>
                {work.axes.map((a, i) => (
                  <tr key={a.axis}>
                    <td className="mono">{a.axis}</td>
                    <td className="mono small">I{"₁₂₃"[i]}ω̇{"₁₂₃"[i]} = τ{"₁₂₃"[i]} − {AXIS[i]!.d}{AXIS[i]!.p}</td>
                    <td className="num">{fmt(a.inertiaDifference)}</td>
                    <td className="num">{fmt(a.omegaProduct)}</td>
                    <td className="num">{fmt(a.gyroscopicTerm)}</td>
                    <td className="num">{fmt(a.torque)}</td>
                    <td className="num">{fmt(a.netEffectiveTorque)}</td>
                    <td className="num">{fmt(a.inertia)}</td>
                    <td className="num" style={{ color: "var(--text)" }}>{fmt(a.angularAcceleration, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">
            Computed by <span className="mono">eulerWorking()</span> in <span className="mono">src/physics/euler.ts</span> — deterministic IEEE-754 double precision.
            “coupling” is the gyroscopic term (I_k − I_j)ω_jω_k, a component of ω × (Iω). Crucible check <span className="mono">math.workbench-form-equivalence</span> confirms this
            form matches the integrator's form to ~1e-14.
          </p>
        </>
      )}
    </>
  );
}
