import { HOLMIUM } from "../../src/materials/holmium.ts";
import { REGISTRY } from "../../src/materials/references.ts";
import type { DataStatus, PropertyCategory } from "../../src/materials/material-schema.ts";
import { MaterialSubmission } from "../../src/ui/material-submission.tsx";
import { fmt } from "../../src/ui/format.ts";

export const metadata = { title: "Element 67 Registry — Pathfinder Lab 067" };

const TAG: Record<DataStatus, string> = { SOURCED: "sourced", DEFINITION: "", DERIVED: "derived", PLACEHOLDER: "placeholder" };
const CATS: PropertyCategory[] = ["identity", "atomic", "magnetic", "structural", "thermal"];

export default function MaterialsPage() {
  const count = (s: DataStatus) => HOLMIUM.properties.filter((p) => p.status === s).length;
  return (
    <>
      <span className="eyebrow">01 · Material reference schema</span>
      <h1>Element 67 — Holmium (Ho)</h1>
      <p className="lede">Material record <span className="mono">{HOLMIUM.schema}</span>. Sourced data and placeholders are kept strictly apart: a placeholder stores no number, and calculations cannot read it.</p>

      <div className="grid grid-3">
        {(["SOURCED", "DEFINITION", "DERIVED", "PLACEHOLDER"] as DataStatus[]).map((s) => (
          <div className="panel" key={s}>
            <div className="eyebrow">{s}</div>
            <div style={{ fontSize: "1.6rem", fontFamily: "var(--mono)" }}>{count(s)}</div>
            <div className="small muted">
              {s === "SOURCED" && "Value + https reference + Operator verification."}
              {s === "DEFINITION" && "True by definition. Not a measurement."}
              {s === "DERIVED" && "Computed by code within a stated model."}
              {s === "PLACEHOLDER" && "Field defined; value null until sourced."}
            </div>
          </div>
        ))}
      </div>
      <div className="notice">There are <b>no sourced measurements</b> in this record. “Assistant recall” notes are unverified text from the engineering assistant — they are not data and must be checked against primary literature.</div>

      {CATS.map((cat) => (
        <section key={cat}>
          <h2 style={{ textTransform: "capitalize" }}>{cat}</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Property</th><th>Status</th><th>Value</th><th>Unit</th><th>Uncertainty</th><th>Temp. [K]</th><th>Conditions</th><th>Reference</th><th>Notes</th></tr></thead>
              <tbody>
                {HOLMIUM.properties.filter((p) => p.category === cat).map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.name}</b><br /><span className="small muted mono">{p.id}</span></td>
                    <td><span className={`tag ${TAG[p.status]}`}>{p.status}</span><br /><span className="small muted mono">{p.evidenceClass}</span></td>
                    <td className="mono">{p.value === null ? <span className="muted">null</span> : typeof p.value === "number" ? fmt(p.value, 8) : p.value}</td>
                    <td className="mono">{p.unit}</td>
                    <td className="mono">{p.uncertainty === null ? <span className="muted">unknown</span> : p.uncertainty}</td>
                    <td className="mono">{p.temperatureK ?? <span className="muted">—</span>}</td>
                    <td className="small">{p.measurementConditions ?? <span className="muted">—</span>}</td>
                    <td className="small">{p.referenceUrl ? <a href={p.referenceUrl}>{p.referenceCitation ?? p.referenceUrl}</a> : <span className="muted">none</span>}</td>
                    <td className="small">
                      {p.notes}
                      {p.derivation && <div className="muted">Derivation: {p.derivation}</div>}
                      {p.assistantRecall && <div style={{ color: "var(--inc)" }}>Assistant recall (unverified): {p.assistantRecall}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <h2>Submit sourced data (Operator)</h2>
      <MaterialSubmission />

      <h2>Laws, constants and context references</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Record</th><th>Class</th><th>Statement</th><th>Citation</th></tr></thead>
          <tbody>
            {REGISTRY.map((r) => (
              <tr key={r.id}>
                <td><b>{r.title}</b><br /><span className="small muted mono">{r.id}</span></td>
                <td className="small mono">{r.evidenceClass}<br /><span className="muted">{r.origin}</span></td>
                <td className="small">{r.statement}{r.quantity && <div className="mono">{fmt(r.quantity.value, 11)} {r.quantity.unit} (u = {r.quantity.uncertainty ?? "unknown"})</div>}</td>
                <td className="small"><span className="mono">{r.citation.status}</span><br />{r.citation.source ?? <span className="muted">no source</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
