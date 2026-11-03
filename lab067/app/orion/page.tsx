import { OrionConsole } from "../../src/ui/orion-console.tsx";
import { ORION_FORBIDDEN, ORION_PERMITTED } from "../../src/orion/contract.ts";
import { KNOWLEDGE } from "../../src/orion/knowledge.ts";

export const metadata = { title: "ORION Console — Pathfinder Lab 067" };

export default function OrionPage() {
  return (
    <>
      <span className="eyebrow">04 · ORION contracts</span>
      <h1>ORION Reasoning Console</h1>
      <p className="lede">A transparent, non-autonomous console. ORION matches your text against {KNOWLEDGE.length} pre-written topic templates by keyword and shows exactly which template it used. It cannot act on its own.</p>
      <div className="notice info">
        <b>No AI model is connected.</b> ORION’s inference engine is NOT IMPLEMENTED in Phase 001. Responses are static text written by the engineering assistant,
        labelled UNVERIFIED_AI_EXPLANATION or HYPOTHESIS. ORION never computes numbers — use the Workbench and Dynamics Lab — and nothing it says is validated.
      </div>
      <OrionConsole />
      <h2>Contract</h2>
      <div className="grid grid-2">
        <div className="panel"><h3 style={{ marginTop: 0 }}>May</h3><ul className="small mono">{ORION_PERMITTED.map((p) => <li key={p}>{p}</li>)}</ul></div>
        <div className="panel"><h3 style={{ marginTop: 0 }}>May not (rejected at admission)</h3><ul className="small mono">{ORION_FORBIDDEN.map((p) => <li key={p}>{p}</li>)}<li>assert any class except HYPOTHESIS / UNVERIFIED_AI_EXPLANATION</li><li>set a validation status</li></ul></div>
      </div>
      <p className="small muted">Enforced in <span className="mono">src/orion/contract.ts</span>; ledger permissions allow ORION to write only <span className="mono">orion-proposal</span> entries.</p>
    </>
  );
}
