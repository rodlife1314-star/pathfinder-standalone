"use client";
import { useState } from "react";
import { canonicalJSON } from "../ledger/canonical.ts";
import type { VerifyResult } from "../ledger/ledger.ts";
import { useLedger } from "./ledger-context.tsx";

export function LedgerView() {
  const { entries, ledger, append, sessionStartedAt } = useLedger();
  const [verify, setVerify] = useState<(VerifyResult & { at: string }) | null>(null);
  const [note, setNote] = useState("");

  const doExport = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), note: "Snapshot export of a non-persistent in-memory ledger. Not a durable or verified record.", verification: ledger.verify(), entries }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lab067-ledger-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="grid grid-2">
        <div className="panel">
          <dl className="kv">
            <dt>Storage</dt><dd style={{ color: "var(--inc)" }}>NON-PERSISTENT — this browser tab’s memory</dd>
            <dt>Session started</dt><dd>{sessionStartedAt}</dd>
            <dt>Entries</dt><dd>{entries.length}</dd>
            <dt>Head hash</dt><dd>{entries.at(-1)?.hash ?? "— (genesis)"}</dd>
          </dl>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={() => setVerify({ ...ledger.verify(), at: new Date().toISOString() })}>Verify chain</button>
            <button className="btn" onClick={doExport} disabled={entries.length === 0}>Export JSON snapshot</button>
          </div>
          {verify && (
            <p className="small" role="status" style={{ color: verify.ok ? "var(--pass)" : "var(--fail)" }}>
              {verify.ok ? `Chain intact: ${verify.length} entries re-hashed and linked correctly` : `BROKEN at entry ${verify.firstBadIndex}: ${verify.reason}`} <span className="muted">({verify.at})</span>
            </p>
          )}
        </div>
        <div className="panel">
          <label className="field">Operator note
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observation, decision or open question" />
          </label>
          <button className="btn" style={{ marginTop: 8 }} disabled={!note.trim()} onClick={() => { append("operator", "operator-note", { note: note.trim() }); setNote(""); }}>Append note</button>
        </div>
      </div>

      <h2>Entries</h2>
      {entries.length === 0 ? (
        <p className="muted">No entries yet. Record a calculation from the Workbench, a run from the Dynamics Lab, Crucible results, or an ORION proposal.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th className="num">#</th><th>Timestamp (UTC)</th><th>Author</th><th>Kind</th><th>Hash / prev</th><th>Payload</th></tr></thead>
            <tbody>
              {[...entries].reverse().map((e) => (
                <tr key={e.index}>
                  <td className="num">{e.index}</td>
                  <td className="mono small">{e.timestamp}</td>
                  <td className="mono small">{e.author}</td>
                  <td className="mono small">{e.kind}</td>
                  <td className="mono small">{e.hash.slice(0, 16)}…<br /><span className="muted">← {e.prevHash.slice(0, 16)}…</span></td>
                  <td style={{ minWidth: 260 }}>
                    <details><summary>{canonicalJSON(e.payload).length.toLocaleString()} bytes</summary><pre className="json">{JSON.stringify(e.payload, null, 2)}</pre></details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
