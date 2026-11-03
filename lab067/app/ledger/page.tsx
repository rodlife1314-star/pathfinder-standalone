import { LedgerView } from "../../src/ui/ledger-view.tsx";
import { WRITE_PERMISSIONS } from "../../src/ledger/ledger.ts";

export const metadata = { title: "Evidence Ledger — Pathfinder Lab 067" };

export default function LedgerPage() {
  return (
    <>
      <span className="eyebrow">06 · Evidence records</span>
      <h1>Evidence Ledger</h1>
      <p className="lede">Local prototype. Each entry records parameters, outputs, a UTC timestamp, software version, author and kind, and is SHA-256 hash-linked to the previous entry.</p>
      <div className="notice danger">
        <b>Non-persistent.</b> Entries live only in this browser tab and are lost on reload or close. The chain is tamper-<i>evident</i> (edits, deletions,
        reordering and forged authors are detected by “Verify chain”), not tamper-proof: anyone holding the data could rewrite and re-hash the whole chain.
        Entries are not signed, not anchored externally and not independently verified.
      </div>
      <LedgerView />
      <h2>Write permissions</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Author</th><th>May write</th></tr></thead>
          <tbody>{Object.entries(WRITE_PERMISSIONS).map(([a, k]) => <tr key={a}><td className="mono">{a}</td><td className="mono small">{k.join(", ")}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="small muted">The <span className="mono">author</span> field is declared by the calling module, not authenticated.</p>
    </>
  );
}
