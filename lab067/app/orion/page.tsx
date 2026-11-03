import { OrionConsole } from "../../src/ui/orion-console.tsx";
import { ORION_FORBIDDEN, ORION_PERMITTED } from "../../src/orion/contract.ts";
import { KNOWLEDGE } from "../../src/orion/knowledge.ts";

export const metadata = { title: "ORION Console — Pathfinder Lab 067" };

export default function OrionPage() {
  return (
    <>
      <span className="eyebrow">04 · ORION contracts</span>
      <h1>ORION Reasoning Console</h1>
      <p className="lede">A transparent, non-autonomous console for reasoning and hypothesis generation. It answers only when asked, takes no actions, and every response shows its trace.</p>
      <div className="notice info">
        <b>Two sources.</b> <i>Static templates</i>: {KNOWLEDGE.length} pre-written topics matched by keyword; no model. <i>Language model</i> (development branch only):
        a provider chosen by the Operator (Anthropic, OpenAI, Gemini or a generic OpenAI-compatible endpoint) called from the server through a provider-independent adapter; the key never reaches the browser. Either way, output is UNVERIFIED_AI_EXPLANATION or HYPOTHESIS,
        passes the contract guard, and is not evaluated by the Crucible. ORION never computes numbers — use the Workbench and Dynamics Lab.
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
