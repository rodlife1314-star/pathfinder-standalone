import { SimulationLab } from "../../src/ui/simulation-lab.tsx";

export const metadata = { title: "Dynamics Lab — Pathfinder Lab 067" };

export default function SimulationPage() {
  return (
    <>
      <span className="eyebrow">03 · Numerical integration</span>
      <h1>Dynamics Simulation Laboratory</h1>
      <p className="lede">Rigid-body rotation integrated numerically — torque-free, or with a fixed magnetic dipole in a uniform field. Use it to study precession, nutation, stability and numerical error.</p>
      <div className="notice danger">
        <b>Scope.</b> An ideal rigid body with no support. In a <i>uniform</i> field a dipole feels torque but <b>zero net force</b>, so nothing here
        models levitation, suspension, a holmium disk, or any device, and nothing demonstrates physical feasibility. The fixed dipole is a point model,
        not holmium's real temperature- and field-dependent magnetisation. Total energy is constant by construction — no energy is gained.
      </div>

      <SimulationLab />

      <h2>Method</h2>
      <div className="eq">{`state  y = (q, ω)        q: unit quaternion (body → world), ω: body angular velocity
dq/dt = ½ q ⊗ (0, ω)
dω/dt from Euler's equations with τ = 0  (torque-free)
                         or τ_body = m_body × (Rᵀ B_world)  (fixed dipole)
RK4:   y(t+Δt) = y + Δt/6 (k₁ + 2k₂ + 2k₃ + k₄),  then q ← q/|q|`}</div>
      <h2>Numerical limitations</h2>
      <ul className="small">
        <li><b>Truncation error.</b> RK4 has global error ∝ Δt⁴ (verified: Crucible <span className="mono">conv.rk4-order</span> measures order 4.00). Halving Δt should cut the error ≈ 16×.</li>
        <li><b>Secular drift.</b> RK4 is not symplectic: energy and |L| errors accumulate slowly over very long runs instead of staying bounded.</li>
        <li><b>Round-off.</b> IEEE-754 doubles give ≈ 1e-16 relative precision; errors near that level are noise, not physics.</li>
        <li><b>Quaternion renormalisation</b> after each step is a non-physical projection that keeps q a valid rotation.</li>
        <li><b>Sensitive dynamics.</b> Near the intermediate axis small errors grow exponentially; trajectories are qualitatively right but timing of flips is step-size dependent.</li>
        <li><b>Step-size guard.</b> Runs with an estimated rotation &gt; 0.5 rad per step are refused; &gt; 0.1 rad warns. This is a heuristic, not a stability proof.</li>
        <li><b>Magnetic model.</b> Point dipole fixed in the body; uniform, static B; no field gradients (no force), induced magnetisation, hysteresis, eddy currents or demagnetisation.</li>
        <li><b>Field time scale.</b> Δt is also checked against √(|m||B|/I_min); strong fields need smaller steps than the spin alone suggests.</li>
        <li><b>Plot sampling.</b> At most ~800 points are drawn; the checks use the same samples, so very brief excursions between samples could be missed.</li>
      </ul>
    </>
  );
}
