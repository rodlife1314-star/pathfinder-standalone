"use client";
import { useEffect, useState } from "react";
import { runCrucible } from "../crucible/crucible.ts";
import type { CrucibleReport } from "../crucible/types.ts";
import type { ValidationStatus } from "../contracts/evidence.ts";
import type { LedgerEntry } from "../ledger/ledger.ts";
import { StatusBadge } from "./status-badge.tsx";
import { RecordedNote, useLedger } from "./ledger-context.tsx";

const ORDER: ValidationStatus[] = ["PASSED", "FAILED", "INCONCLUSIVE", "NOT TESTED", "NOT IMPLEMENTED"];

export function CrucibleRunner() {
  const { append } = useLedger();
  const [report, setReport] = useState<CrucibleReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<LedgerEntry[] | null>(null);

  const run = () => {
    setBusy(true); setRec(null);
    // Yield one frame so the busy state paints before the synchronous run.
    requestAnimationFrame(() => setTimeout(() => { setReport(runCrucible()); setBusy(false); }, 0));
  };
  useEffect(run, []);

  const record = () => {
    if (!report) return;
    setRec(report.checks.map((c) => append("crucible", "validation", { ...c, runtime: report.runtime })));
  };

  return (
    <>
      <div className="row">
        <button className="btn primary" onClick={run} disabled={busy}>{busy ? "Running…" : "Run all checks"}</button>
        {report && <button className="btn" onClick={record} disabled={busy}>Record results to ledger</button>}
        {rec && <RecordedNote entries={[rec.at(-1)!]} />}
      </div>
      {report && (
        <>
          <p className="small muted">
            Executed in this browser at <span className="mono">{report.startedAt}</span> · {report.runtime} · v{report.softwareVersion}
          </p>
          <div className="row" style={{ margin: "6px 0 12px" }}>
            {ORDER.map((s) => <span key={s} className="panel" style={{ padding: "6px 12px" }}><StatusBadge status={s} /> <span className="mono">{report.summary[s]}</span></span>)}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Status</th><th>Check</th><th>Method</th><th>Measured outcome</th></tr></thead>
              <tbody>
                {report.checks.map((c) => (
                  <tr key={c.id}>
                    <td><StatusBadge status={c.status} /></td>
                    <td style={{ minWidth: 180 }}><b>{c.title}</b><br /><span className="small muted mono">{c.id} · {c.category}</span></td>
                    <td className="small" style={{ minWidth: 240 }}>{c.method}</td>
                    <td className="small" style={{ minWidth: 220 }}>
                      {c.detail}
                      {c.executedAt && <div className="muted mono">ran {c.durationMs?.toFixed(1)} ms</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
