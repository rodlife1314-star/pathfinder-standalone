import { EulerWorkbench } from "../../src/ui/workbench.tsx";

export const metadata = { title: "Euler Workbench — Pathfinder Lab 067" };

const SYMBOLS: [string, string, string, string][] = [
  ["I₁, I₂, I₃", "Principal moments of inertia", "kg·m²", "Resistance to angular acceleration about each principal axis; set by how mass is distributed."],
  ["ω₁, ω₂, ω₃", "Angular-velocity components in body axes", "rad/s", "Spin rate about each body axis. The radian is dimensionless in SI."],
  ["ω̇ᵢ", "Rate of change of ωᵢ in the body frame", "rad/s²", "Angular acceleration seen by an observer rotating with the body."],
  ["τ₁, τ₂, τ₃", "External torque about the centre of mass, body axes", "N·m", "Twisting action of outside forces (e.g. magnetic torque m × B)."],
  ["(I_k − I_j)ω_jω_k", "Gyroscopic coupling term", "N·m", "Arises because the body axes rotate. Lets ω change even with zero torque."],
  ["L = Iω", "Angular momentum", "kg·m²/s", "Constant in the inertial frame when τ = 0. Generally not parallel to ω."],
  ["T = ½ω·Iω", "Rotational kinetic energy", "J", "Constant when τ = 0; changes at rate τ·ω otherwise."],
];

export default function WorkbenchPage() {
  return (
    <>
      <span className="eyebrow">02 · Physics engine</span>
      <h1>Euler Equation Workbench</h1>
      <p className="lede">Edit the inputs; angular acceleration is recomputed by deterministic TypeScript on every change. Invalid or nonphysical inputs are rejected by the Crucible before any calculation runs.</p>
      <div className="eq">{`I₁ (dω₁/dt) = τ₁ − (I₃ − I₂) ω₂ ω₃
I₂ (dω₂/dt) = τ₂ − (I₁ − I₃) ω₃ ω₁
I₃ (dω₃/dt) = τ₃ − (I₂ − I₁) ω₁ ω₂`}</div>
      <p className="small muted">Classification: ESTABLISHED_LAW (classical rigid-body mechanics). Equivalent to I ω̇ + ω × (Iω) = τ with I diagonal.</p>

      <h2>Calculator</h2>
      <EulerWorkbench />

      <h2>Symbols and SI units</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Symbol</th><th>Meaning</th><th>SI unit</th><th>Physical interpretation</th></tr></thead>
          <tbody>{SYMBOLS.map(([s, m, u, p]) => <tr key={s}><td className="mono">{s}</td><td>{m}</td><td className="mono">{u}</td><td>{p}</td></tr>)}</tbody>
        </table>
      </div>

      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Assumptions</h3>
          <ul className="small">
            <li>Rigid body — no flexing, fluid or internal moving parts.</li>
            <li>Body axes are principal axes through the centre of mass (diagonal inertia tensor).</li>
            <li>The reference frame for L is inertial.</li>
            <li>τ is the total external torque about the centre of mass, in body axes.</li>
            <li>Classical, non-relativistic mechanics.</li>
          </ul>
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Verify independently</h3>
          <ul className="small">
            <li><b>By hand:</b> preset “Asymmetric body” gives ω̇ = (−1, 1, −1/3) rad/s². Check: I₁ω̇₁ = 0 − (3 − 2)(1)(1) = −1.</li>
            <li><b>Limiting case:</b> I₁ = I₂ = I₃ ⇒ every coupling term is 0 and ω̇ = τ/I.</li>
            <li><b>Steady spin:</b> ω along one principal axis, τ = 0 ⇒ ω̇ = 0.</li>
            <li><b>Units:</b> each term is kg·m² × s⁻² = N·m (Crucible check <span className="mono">dim.euler-equation</span>).</li>
            <li><b>Code:</b> run <span className="mono">npm test</span> in <span className="mono">lab067/</span>.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
