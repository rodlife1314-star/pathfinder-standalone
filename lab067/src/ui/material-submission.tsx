"use client";
import { useState } from "react";
import { HOLMIUM } from "../materials/holmium.ts";
import { parseNumericField } from "../crucible/validators.ts";
import type { LedgerEntry } from "../ledger/ledger.ts";
import { RecordedNote, useLedger } from "./ledger-context.tsx";

/**
 * Operator data submission. Writes a PROPOSAL to the ledger only — it never
 * modifies the material registry, which changes solely by reviewed code commit.
 */
export function MaterialSubmission() {
  const { append } = useLedger();
  const [f, setF] = useState({ property: HOLMIUM.properties.find((p) => p.status === "PLACEHOLDER")!.id, value: "", unit: "", uncertainty: "", temperature: "", conditions: "", url: "", citation: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [rec, setRec] = useState<LedgerEntry[] | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value }); setRec(null); };

  const submit = () => {
    const errs: string[] = [];
    const prop = HOLMIUM.properties.find((p) => p.id === f.property)!;
    const val = parseNumericField(f.value, "value");
    const textual = prop.unit === "—";
    if (!textual && !val.ok) errs.push(val.error);
    if (textual && f.value.trim() === "") errs.push("value: required");
    let unc: number | null = null;
    if (f.uncertainty.trim()) { const u = parseNumericField(f.uncertainty, "uncertainty"); if (!u.ok) errs.push(u.error); else if (u.value < 0) errs.push("uncertainty must be ≥ 0"); else unc = u.value; }
    let temp: number | null = null;
    if (f.temperature.trim()) { const t = parseNumericField(f.temperature, "temperature"); if (!t.ok) errs.push(t.error); else if (t.value < 0) errs.push("temperature must be ≥ 0 K"); else temp = t.value; }
    let url: URL | null = null;
    try { url = new URL(f.url.trim()); } catch { errs.push("reference URL: not a valid URL"); }
    if (url && url.protocol !== "https:") errs.push("reference URL must use https");
    if (!f.citation.trim()) errs.push("citation text: required (authors, title, year)");
    if (!f.conditions.trim()) errs.push("measurement conditions: required");
    setErrors(errs);
    if (errs.length) return;
    const e = append("operator", "operator-data-submission", {
      status: "PENDING REVIEW — not applied to the registry",
      element: "Ho", propertyId: prop.id, propertyName: prop.name,
      value: textual ? f.value.trim() : (val as { value: number }).value, unit: f.unit.trim() || prop.unit,
      uncertainty: unc, temperatureK: temp, measurementConditions: f.conditions.trim(),
      referenceUrl: url!.href, referenceCitation: f.citation.trim(),
      note: "URL not fetched or checked by the application. Registry changes require a reviewed code commit.",
    });
    setRec([e]);
  };

  return (
    <div className="panel">
      <p className="small muted" style={{ marginTop: 0 }}>Records a <b>proposal</b> in the in-memory Evidence Ledger. It does not change the registry, and the application does not fetch or check the URL.</p>
      <div className="fields">
        <label className="field" style={{ gridColumn: "1 / -1" }}>Property
          <select value={f.property} onChange={set("property")}>
            {HOLMIUM.properties.filter((p) => p.status === "PLACEHOLDER").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="field">Value<input value={f.value} onChange={set("value")} /></label>
        <label className="field">Unit<input value={f.unit} placeholder={HOLMIUM.properties.find((p) => p.id === f.property)?.unit} onChange={set("unit")} /></label>
        <label className="field">Std. uncertainty<input value={f.uncertainty} onChange={set("uncertainty")} /></label>
        <label className="field">Temperature [K]<input value={f.temperature} onChange={set("temperature")} /></label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>Measurement conditions<input value={f.conditions} onChange={set("conditions")} placeholder="e.g. single crystal, c-axis, zero field" /></label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>Reference URL (https)<input value={f.url} onChange={set("url")} /></label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>Citation<input value={f.citation} onChange={set("citation")} placeholder="Authors, title, journal, year" /></label>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={submit}>Record proposal to ledger</button>
        <RecordedNote entries={rec} />
      </div>
      {errors.length > 0 && <ul className="errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
    </div>
  );
}
