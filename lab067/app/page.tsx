import Link from "next/link";
import { runCrucible } from "../src/crucible/crucible.ts";
import { HOLMIUM } from "../src/materials/holmium.ts";
import { ORION_ENGINE_STATUS } from "../src/orion/contract.ts";
import type { ValidationStatus } from "../src/contracts/evidence.ts";
import { StatusBadge } from "../src/ui/status-badge.tsx";

export const dynamic = "force-dynamic";

const ORDER: ValidationStatus[] = ["PASSED", "FAILED", "INCONCLUSIVE", "NOT TESTED", "NOT IMPLEMENTED"];

export default function Dashboard() {
  const report = runCrucible();
  const placeholders = HOLMIUM.properties.filter((p) => p.status === "PLACEHOLDER").length;
  const sourced = HOLMIUM.properties.filter((p) => p.status === "SOURCED").length;
  const cards = [
    { href: "/materials", n: "01", t: "Element 67 Registry", s: `${sourced} sourced · ${placeholders} placeholders`, d: "Holmium material record with explicit data status." },
    { href: "/workbench", n: "02", t: "Euler Workbench", s: "Working", d: "Angular acceleration from I, ω, τ with full intermediate values." },
    { href: "/simulation", n: "03", t: "Dynamics Lab", s: "Working (torque-free)", d: "RK4 rigid-body simulation with conservation-error tracking." },
    { href: "/orion", n: "04", t: "ORION Console", s: `Templates only · engine ${ORION_ENGINE_STATUS}`, d: "Transparent keyword-matched explanations; no AI model." },
    { href: "/crucible", n: "05", t: "Scientific Crucible", s: `${report.checks.length} checks`, d: "Independent validation with explicit statuses." },
    { href: "/ledger", n: "06", t: "Evidence Ledger", s: "In-browser · non-persistent", d: "Hash-linked records of calculations and validations." },
  ];
  return (
    <>
      <span className="eyebrow">00 · Research dashboard</span>
      <h1>Rotational dynamics of a proposed shaftless holmium disk</h1>
      <p className="lede">Phase 001 scaffold. The research question concerns angular momentum, precession, magnetic torque, low-temperature magnetic behaviour and energy constraints, starting from Euler’s rigid-body equations.</p>

      <div className="panel" style={{ borderLeft: "3px solid var(--fail)" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <b>Hypothesis status</b><span className="tag hyp">HYPOTHESIS · UNVALIDATED</span>
        </div>
        <p className="small" style={{ marginBottom: 0 }}>
          The shaftless disk is an exploratory hypothesis, not an established or working device. Nothing in this application demonstrates feasibility,
          levitation or energy generation. No holmium-specific model exists yet: all simulations use idealised rigid bodies.
        </p>
      </div>

      <h2>Crucible summary <span className="small muted mono" style={{ fontWeight: 400 }}>executed {report.startedAt} on server</span></h2>
      <div className="row">
        {ORDER.map((s) => <span key={s} className="panel" style={{ padding: "6px 12px" }}><StatusBadge status={s} /> <span className="mono">{report.summary[s]}</span></span>)}
        <Link href="/crucible" className="small">Details →</Link>
      </div>

      <h2>Sections</h2>
      <div className="grid grid-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card-link">
            <div className="panel">
              <span className="eyebrow">{c.n}</span>
              <div style={{ fontWeight: 600, margin: "2px 0" }}>{c.t}</div>
              <div className="small mono" style={{ color: "var(--text-2)" }}>{c.s}</div>
              <div className="small muted" style={{ marginTop: 6 }}>{c.d}</div>
            </div>
          </Link>
        ))}
      </div>

      <h2>Established constraints the hypothesis must respect</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Constraint</th><th>Class</th><th>Consequence for the disk</th></tr></thead>
          <tbody>
            <tr><td>Energy conservation for torque-free rotation (T constant)</td><td className="mono small">ESTABLISHED_LAW</td><td className="small">Spinning cannot create energy; extraction or dissipation only reduces T.</td></tr>
            <tr><td>Angular-momentum conservation (dL/dt = τ)</td><td className="mono small">ESTABLISHED_LAW</td><td className="small">Any change of spin axis direction requires external torque.</td></tr>
            <tr><td>Intermediate-axis instability; with dissipation only the major axis is stable</td><td className="mono small">ESTABLISHED_LAW</td><td className="small">A disk must spin about its symmetry (largest-moment) axis.</td></tr>
            <tr><td>Earnshaw’s theorem</td><td className="mono small">ESTABLISHED_LAW</td><td className="small">No stable static levitation from static fields of fixed magnets alone; any suspension needs a specified mechanism that evades it.</td></tr>
            <tr><td>Holmium magnetic ordering requires low temperature</td><td className="mono small">PLACEHOLDER</td><td className="small">Transition temperatures not yet sourced; cryogenic model NOT IMPLEMENTED.</td></tr>
          </tbody>
        </table>
      </div>
      <p className="small muted">Constraint statements are explanatory text written by the engineering assistant; citations are pending (see Element 67 Registry).</p>

      <h2>Not implemented in Phase 001</h2>
      <ul className="small">
        <li>Magnetic torque in the Dynamics Lab (engine supports a fixed dipole in uniform B; UI is torque-free only).</li>
        <li>Holmium material model, field gradients / forces, suspension and stability analysis.</li>
        <li>Cryogenic thermal model. Durable or signed ledger. ORION inference engine.</li>
        <li>Hardware control, experiments and autonomous agents are out of scope by governance.</li>
      </ul>
    </>
  );
}
