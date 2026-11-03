import { runCrucible, recordReport } from "../src/crucible/crucible.ts";
import { EvidenceLedger } from "../src/ledger/ledger.ts";
import { REGISTRY } from "../src/registry/references.ts";
import { ORION_ENGINE_STATUS, ORION_FORBIDDEN, ORION_PERMITTED } from "../src/orion/contract.ts";
import type { ValidationStatus } from "../src/contracts/evidence.ts";
import { StatusBadge } from "./status-badge.tsx";

// The Crucible executes on every request; nothing on this page is a cached or hand-written result.
export const dynamic = "force-dynamic";

const MODULES: { name: string; path: string; status: string; note: string }[] = [
  { name: "UI / learning environment", path: "app/", status: "Scaffold", note: "This status board and one learning page." },
  { name: "Reference registry", path: "src/registry/", status: "Implemented (seed)", note: "Read-only; 0 Operator-verified citations." },
  { name: "Mathematics engine", path: "src/math/", status: "Implemented", note: "Vectors, quaternions, inertia, Euler, dipole torque, Hund's rules." },
  { name: "Simulation engine", path: "src/sim/", status: "Implemented", note: "RK4, rigid body + fixed dipole in uniform B." },
  { name: "ORION reasoning kernel", path: "src/orion/", status: `Contract only — engine ${ORION_ENGINE_STATUS}`, note: "Admission guard enforced; no LLM." },
  { name: "Crucible validation", path: "src/crucible/", status: "Implemented", note: "Results below are executed live." },
  { name: "Evidence ledger", path: "src/ledger/", status: "In-memory only", note: "SHA-256 hash-linked, tamper-evident; NOT durable." },
];

export default function StatusPage() {
  const report = runCrucible();
  const ledger = new EvidenceLedger();
  recordReport(ledger, report);
  const verify = ledger.verify();
  const order: ValidationStatus[] = ["PASSED", "FAILED", "INCONCLUSIVE", "NOT TESTED", "NOT IMPLEMENTED"];

  return (
    <main>
      <h1>System status</h1>
      <p className="lede">
        Crucible run at <span className="mono">{report.startedAt}</span> on <span className="mono">{report.runtime}</span>,
        software v{report.softwareVersion}. Summary:{" "}
        {order.map((s, i) => (
          <span key={s}>{i > 0 && " · "}<StatusBadge status={s} /> {report.summary[s]}</span>
        ))}
      </p>

      <div className="notice">
        Phase 001 is scaffolding. The simulation uses idealised test bodies, <strong>not holmium</strong>. No
        material model, cryogenic model, hardware control, levitation or energy claim exists in this system.
      </div>

      <h2>Crucible checks</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Status</th><th>Check</th><th>Method &amp; measured outcome</th></tr></thead>
          <tbody>
            {report.checks.map((c) => (
              <tr key={c.id}>
                <td><StatusBadge status={c.status} /></td>
                <td><strong>{c.title}</strong><br /><span className="small mono">{c.id} · {c.category}</span></td>
                <td>
                  <div className="small">{c.method}</div>
                  <div>{c.detail}</div>
                  {c.executedAt && <div className="small mono">executed {c.executedAt} · {c.durationMs?.toFixed(1)} ms</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Evidence ledger (this request only)</h2>
      <p>
        {verify.length} validation entries were appended by the Crucible. Chain verification:{" "}
        <strong>{verify.ok ? "intact" : `BROKEN at ${verify.firstBadIndex}: ${verify.reason}`}</strong>. Head hash{" "}
        <span className="mono">{verify.headHash.slice(0, 24)}…</span>
      </p>
      <p className="small">
        The ledger lives in server memory for this request and is then discarded. It is tamper-evident (altered,
        reordered or re-hashed entries are detected) but not tamper-proof, not signed, and not persisted.
      </p>

      <h2>Modules</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Module</th><th>Path</th><th>State</th><th>Note</th></tr></thead>
          <tbody>
            {MODULES.map((m) => (
              <tr key={m.name}><td>{m.name}</td><td className="mono">{m.path}</td><td>{m.status}</td><td>{m.note}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Reference registry</h2>
      <p className="small">
        <em>AI_RECALL</em> = typed in by the engineering assistant from memory; unverified. Only the Operator may mark a
        citation OPERATOR_VERIFIED.
      </p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Record</th><th>Class / origin</th><th>Value</th><th>Citation</th></tr></thead>
          <tbody>
            {REGISTRY.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.title}</strong><br /><span className="small">{r.statement}</span></td>
                <td className="small mono">{r.evidenceClass}<br />{r.origin}</td>
                <td className="mono">
                  {r.quantity ? `${r.quantity.unit === "1" ? r.quantity.value : `${Number(r.quantity.value.toPrecision(8))} ${r.quantity.unit}`}` : "—"}
                  {r.quantity && <div className="small">u = {r.quantity.uncertainty === null ? "unknown" : r.quantity.uncertainty}</div>}
                </td>
                <td className="small"><span className="mono">{r.citation.status}</span><br />{r.citation.source ?? "no source"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>ORION contract</h2>
      <p>Permitted proposal kinds: <span className="mono">{ORION_PERMITTED.join(", ")}</span>.</p>
      <p>Rejected at admission: <span className="mono">{ORION_FORBIDDEN.join(", ")}</span>, any evidence class other than HYPOTHESIS / UNVERIFIED_AI_EXPLANATION, and any attempt to set a validation status.</p>

      <h2>Review record</h2>
      <p>No architecture review by Jemma has been recorded for this phase.</p>
    </main>
  );
}
