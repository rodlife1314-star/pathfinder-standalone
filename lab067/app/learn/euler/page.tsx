import { eulerAngularAcceleration, gyroscopicTerm, symmetricTopBodyPrecessionRate } from "../../../src/math/euler.ts";
import { solidCylinder } from "../../../src/math/inertia.ts";
import { magneticTorque, dipolePotentialEnergy } from "../../../src/math/magnetic.ts";
import type { Vec3 } from "../../../src/math/vec3.ts";

export const metadata = { title: "Euler's equations — Pathfinder Lab 067" };

const n = (x: number, p = 5) => (Object.is(x, -0) ? 0 : Number(x.toPrecision(p))).toString();
const vec = (v: Vec3, p = 5) => `(${v.map((x) => n(x, p)).join(", ")})`;

const SYMBOLS: [string, string, string, string][] = [
  ["I₁, I₂, I₃", "Principal moments of inertia", "kg·m²", "Resistance to angular acceleration about each principal axis; depends on mass and how far it sits from the axis."],
  ["ω = (ω₁, ω₂, ω₃)", "Angular velocity, body components", "rad/s", "How fast, and about which axis, the body spins — measured along axes fixed in the body."],
  ["ω̇", "Time derivative of ω in the body frame", "rad/s²", "Angular acceleration as seen by an observer rotating with the body."],
  ["τ = (τ₁, τ₂, τ₃)", "External torque about the centre of mass", "N·m", "The twisting action of outside forces, e.g. a magnetic field acting on a dipole."],
  ["L = Iω", "Angular momentum", "kg·m²/s", "Conserved in an inertial frame when τ = 0. Note L is generally NOT parallel to ω."],
  ["ω × (Iω)", "Gyroscopic term", "N·m", "Appears because the body axes rotate; it is why a spinning body can accelerate with zero torque."],
  ["m", "Magnetic dipole moment", "A·m² (= J/T)", "Strength and direction of a magnet; for a current loop, current × area."],
  ["B", "Magnetic flux density", "T (= kg·s⁻²·A⁻¹)", "The external magnetic field."],
];

export default function EulerPage() {
  // Worked example 1 — values computed live by the engine.
  const m = 1.0, r = 0.05, h = 0.2;
  const I = solidCylinder(m, r, h);
  const w: Vec3 = [0.5, 0, 20];
  const wdot = eulerAngularAcceleration(I, w, [0, 0, 0]);
  const gyro = gyroscopicTerm(I, w);
  const Omega = symmetricTopBodyPrecessionRate(I[0], I[2], w[2]);

  // Worked example 2.
  const mu: Vec3 = [0, 1, 0], B: Vec3 = [0, 0, 0.5];
  const tau = magneticTorque(mu, B);
  const U = dipolePotentialEnergy(mu, B);

  return (
    <main>
      <h1>Euler&apos;s rigid-body equations</h1>
      <p className="lede">Classification: <strong>ESTABLISHED_LAW</strong> within classical mechanics. Explanatory text on this page is written by the
        engineering assistant (<em>UNVERIFIED_AI_EXPLANATION</em>); every number is computed by <span className="mono">src/math</span>.</p>

      <h2>1. The equations</h2>
      <div className="eq">{`I₁ ω̇₁ = (I₂ − I₃) ω₂ ω₃ + τ₁
I₂ ω̇₂ = (I₃ − I₁) ω₃ ω₁ + τ₂
I₃ ω̇₃ = (I₁ − I₂) ω₁ ω₂ + τ₃

vector form:   I ω̇ + ω × (I ω) = τ`}</div>
      <p>
        They are Newton&apos;s second law for rotation, <span className="mono">dL/dt = τ</span>, rewritten in axes that turn with the body. In those axes
        the inertia tensor is constant and diagonal — that is the advantage — but the price is the extra term <span className="mono">ω × (Iω)</span>,
        which comes from the rule for differentiating a vector in a rotating frame:
        <span className="mono"> (dL/dt)_world = (dL/dt)_body + ω × L</span>.
      </p>

      <h2>2. Symbols and SI units</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Symbol</th><th>Meaning</th><th>SI unit</th><th>Physical interpretation</th></tr></thead>
          <tbody>{SYMBOLS.map(([s, mn, u, p]) => <tr key={s}><td className="mono">{s}</td><td>{mn}</td><td className="mono">{u}</td><td>{p}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="small">Dimension check: kg·m² × s⁻² = kg·m²·s⁻² = N·m on every term. The Crucible check
        <span className="mono"> dim.euler-equation</span> executes this automatically.</p>

      <h2>3. Assumptions</h2>
      <ul>
        <li>The body is rigid: distances between its mass elements never change.</li>
        <li>Body axes are <em>principal axes</em> through the centre of mass (so the inertia tensor is diagonal).</li>
        <li>The world frame is inertial (not itself accelerating or rotating).</li>
        <li>τ is the total external torque about the centre of mass, written in body axes.</li>
        <li>Classical and non-relativistic. Fluid fills, flexing, or internal rotors break these equations.</li>
      </ul>

      <h2>4. Worked example A — a spinning cylinder with no torque</h2>
      <p>A homogeneous solid cylinder: m = {m} kg, r = {r} m, h = {h} m, symmetry axis along body z.</p>
      <div className="eq">{`I₁ = I₂ = m(3r² + h²)/12 = ${n(I[0])} kg·m²
I₃     = m r²/2         = ${n(I[2])} kg·m²

ω = ${vec(w)} rad/s,   τ = 0

ω̇₁ = (I₂ − I₃) ω₂ ω₃ / I₁ = ${n(wdot[0])} rad/s²      (ω₂ = 0)
ω̇₂ = (I₃ − I₁) ω₃ ω₁ / I₂ = ${n(wdot[1])} rad/s²
ω̇₃ = (I₁ − I₂) ω₁ ω₂ / I₃ = ${n(wdot[2])} rad/s²      (I₁ = I₂)

gyroscopic term ω × (Iω) = ${vec(gyro)} N·m`}</div>
      <p>
        With no torque at all, ω still changes: its component perpendicular to the symmetry axis rotates (in the body frame)
        at <span className="mono">Ω = (I₃ − I⊥) ω₃ / I⊥ = {n(Omega)} rad/s</span>. The sign is negative because this cylinder
        is <em>prolate</em> (I₃ &lt; I⊥): seen from the body, ω circles the axis in the opposite sense to the spin.
        The world-frame angular momentum L stays fixed throughout.
      </p>

      <h2>5. Worked example B — torque on a magnetic dipole</h2>
      <div className="eq">{`m = ${vec(mu)} A·m²,   B = ${vec(B)} T

τ = m × B = (m_y B_z − m_z B_y,  m_z B_x − m_x B_z,  m_x B_y − m_y B_x)
          = ${vec(tau)} N·m

U = −m·B = ${n(U)} J     (m ⟂ B: zero energy, maximum torque)`}</div>
      <p>
        The torque tries to rotate m toward B. Because τ = m × B is always perpendicular to B, the component of angular
        momentum along B is conserved — the basis of Larmor-type precession and of the Crucible check
        <span className="mono"> cons.magnetic</span>.
      </p>
      <div className="notice">
        This is a point dipole with a <em>fixed</em> moment in a <em>uniform</em> field. It does not describe holmium metal,
        whose magnetisation depends on temperature, field history and crystal direction. That model does not exist yet.
      </div>

      <h2>6. How to verify independently</h2>
      <ol>
        <li><strong>By hand:</strong> recompute I₁ and I₃ from the formulas above, then ω̇₂ = (I₃ − I₁)·20·0.5/I₂. You should match to the digits shown.</li>
        <li><strong>Limiting cases:</strong> for a sphere (I₁ = I₂ = I₃) the gyroscopic term vanishes and ω̇ = τ/I. Spin exactly about one principal axis gives ω̇ = 0.</li>
        <li><strong>Cross product:</strong> use the right-hand rule: y × z = x, so (0,1,0) × (0,0,0.5) points along +x.</li>
        <li><strong>Analytic vs numerical:</strong> the Crucible compares the RK4 simulation with the exact symmetric-top solution (check <span className="mono">analytic.symmetric-top</span>).</li>
        <li><strong>Experiment you can do safely:</strong> toss a book spinning about each of its three axes. Rotation about the middle axis tumbles — the intermediate-axis theorem (check <span className="mono">falsify.intermediate-axis</span>).</li>
        <li><strong>Run the tests:</strong> <span className="mono">npm test</span> in <span className="mono">lab067/</span>.</li>
      </ol>
    </main>
  );
}
