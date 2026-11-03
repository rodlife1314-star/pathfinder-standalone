"use client";
import { useEffect, useState } from "react";
import type { OrionModelResponse } from "../orion/model/service.ts";
import type { PublicDescriptor } from "../orion/model/config.ts";
import { ModelResponseView } from "./orion-model-panel.tsx";
import { askOrion, responseToProposal, type OrionQueryKind, type OrionResponse } from "../orion/console.ts";
import { recordOrionProposal } from "../orion/contract.ts";
import type { LedgerEntry } from "../ledger/ledger.ts";
import { RecordedNote, useLedger } from "./ledger-context.tsx";

const KINDS: { v: OrionQueryKind; label: string }[] = [
  { v: "scientific-question", label: "Scientific question" },
  { v: "explain-equation", label: "Explain an equation" },
  { v: "list-assumptions", label: "List assumptions" },
  { v: "propose-experiment", label: "Propose a numerical experiment" },
];
const SUGGEST = [
  ["scientific-question", "Why does a spinning disk precess?"],
  ["explain-equation", "Euler's equations"],
  ["list-assumptions", "magnetic torque on a dipole"],
  ["propose-experiment", "intermediate axis stability"],
  ["scientific-question", "Can the shaftless disk levitate?"],
  ["scientific-question", "Could the disk generate energy?"],
] as const;

export function OrionConsole() {
  const { append, appendWith } = useLedger();
  const [kind, setKind] = useState<OrionQueryKind>("scientific-question");
  const [text, setText] = useState("");
  const [resp, setResp] = useState<OrionResponse | null>(null);
  const [rec, setRec] = useState<LedgerEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"templates" | "model">("templates");
  const [desc, setDesc] = useState<(PublicDescriptor & { reason?: string }) | null>(null);
  const [modelResp, setModelResp] = useState<OrionModelResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [callErr, setCallErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/orion", { cache: "no-store" }).then((r) => r.json()).then(setDesc).catch(() => setDesc(null));
  }, []);

  const askModel = async (k: OrionQueryKind, q: string) => {
    setBusy(true); setModelResp(null); setCallErr(null);
    try {
      const r = await fetch("/api/orion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: k, text: q }) });
      const body = await r.json();
      if (body?.schema) setModelResp(body as OrionModelResponse);
      else setCallErr(`${body?.error?.kind ?? "error"}: ${body?.error?.message ?? `HTTP ${r.status}`}`);
    } catch (e) { setCallErr(`network: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };

  const ask = (k = kind, q = text) => {
    if (!q.trim() || busy) return;
    setRec(null); setErr(null);
    if (mode === "model") { setResp(null); void askModel(k, q.trim()); }
    else { setModelResp(null); setResp(askOrion({ kind: k, text: q })); }
  };
  const recordProposal = () => {
    if (!resp) return;
    try {
      // Routed through the ORION contract guard before reaching the ledger.
      setRec([appendWith((l) => recordOrionProposal(l, responseToProposal(resp)))]);
    } catch (x) { setErr((x as Error).message); }
  };
  const recordQuestion = () => {
    if (!resp) return;
    setRec([append("operator", "operator-note", { openQuestion: resp.query.text, raisedVia: "ORION console", orionMatched: resp.matched })]);
  };

  return (
    <>
      <div className="panel">
        <fieldset style={{ marginBottom: 10 }}>
          <legend>Reasoning source</legend>
          <div className="row">
            <label className="row" style={{ gap: 6 }}><input type="radio" name="mode" checked={mode === "templates"} onChange={() => setMode("templates")} /> Static templates (offline, no model)</label>
            <label className="row" style={{ gap: 6 }}>
              <input type="radio" name="mode" checked={mode === "model"} disabled={!desc?.configured} onChange={() => setMode("model")} />
              Language model {desc ? (desc.configured ? <span className="mono small">{desc.provider}: {desc.model} @ {desc.host}</span> : <span className="small muted">(not configured)</span>) : "(checking…)"}
            </label>
          </div>
          {desc && !desc.configured && <p className="small muted" style={{ marginBottom: 0 }}>Model mode unavailable: {desc.reason ?? "not configured on the server"}.</p>}
        </fieldset>
        <div className="fields" style={{ gridTemplateColumns: "minmax(180px, 240px) 1fr" }}>
          <label className="field">Request type
            <select value={kind} onChange={(e) => setKind(e.target.value as OrionQueryKind)}>{KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}</select>
          </label>
          <label className="field">Question or topic
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="e.g. Why does a spinning disk precess?" style={{ fontFamily: "var(--sans)" }} />
          </label>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => ask()} disabled={busy}>{busy ? "Waiting for model…" : "Ask ORION"}</button>
          <span className="small muted">Try:</span>
          {SUGGEST.map(([k, q]) => <button key={q} className="btn" style={{ padding: "4px 10px", fontSize: "0.78rem" }} onClick={() => { setKind(k); setText(q); ask(k, q); }}>{q}</button>)}
        </div>
      </div>

      {callErr && <div className="notice danger"><b>ORION request failed.</b> <span className="mono small">{callErr}</span></div>}
      {modelResp && <ModelResponseView r={modelResp} />}
      {resp && (
        <section aria-live="polite" style={{ marginTop: 16 }}>
          <div className="panel">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>{resp.title}</h2>
              <span className={`tag ${resp.evidenceClass === "HYPOTHESIS" ? "hyp" : "placeholder"}`}>{resp.evidenceClass}</span>
            </div>
            {resp.sections.map((s) => (
              <div key={s.heading}>
                <h3>{s.heading}</h3>
                {s.heading.toLowerCase().includes("equation") ? <div className="eq">{s.lines.join("\n")}</div> : <ul>{s.lines.map((l) => <li key={l}>{l}</li>)}</ul>}
              </div>
            ))}
            {resp.openQuestions.length > 0 && (<><h3>Open questions / missing evidence</h3><ul>{resp.openQuestions.map((q) => <li key={q}>{q}</li>)}</ul></>)}
            {resp.references.length > 0 && <p className="small muted">Relies on registry records: <span className="mono">{resp.references.join(", ")}</span></p>}
            <div className="row" style={{ marginTop: 10 }}>
              {resp.matched && <button className="btn" onClick={recordProposal}>Record as ORION proposal</button>}
              <button className="btn" onClick={recordQuestion}>Record as open question</button>
              <RecordedNote entries={rec} />
            </div>
            {err && <ul className="errors"><li>{err}</li></ul>}
          </div>
          <div className="panel" style={{ marginTop: 12 }}>
            <span className="eyebrow">Reasoning trace</span>
            <ol className="small mono" style={{ marginBottom: 0 }}>{resp.trace.map((t) => <li key={t}>{t}</li>)}</ol>
            <p className="small" style={{ marginBottom: 0 }}>Model executed: <b>no</b> · Calculations performed: <b>no</b> · Independently verified: <b>no</b></p>
          </div>
        </section>
      )}
    </>
  );
}
