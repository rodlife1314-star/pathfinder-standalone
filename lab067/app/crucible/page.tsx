import { CrucibleRunner } from "../../src/ui/crucible-runner.tsx";

export const metadata = { title: "Scientific Crucible — Pathfinder Lab 067" };

export default function CruciblePage() {
  return (
    <>
      <span className="eyebrow">05 · Validation</span>
      <h1>Scientific Crucible</h1>
      <p className="lede">Independent validation, kept separate from the calculation engines (<span className="mono">src/crucible/</span> only calls them and compares against analytic results, invariants and known theorems). Every check below executes now, in your browser.</p>
      <div className="table-wrap" style={{ marginBottom: 16 }}>
        <table>
          <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><span className="status s-PASSED">PASSED</span></td><td className="small">Executed; measured values met the stated criterion.</td></tr>
            <tr><td><span className="status s-FAILED">FAILED</span></td><td className="small">Executed; criterion not met (or the check threw).</td></tr>
            <tr><td><span className="status s-INCONCLUSIVE">INCONCLUSIVE</span></td><td className="small">Executed; result cannot decide the question.</td></tr>
            <tr><td><span className="status s-NOT-TESTED">NOT TESTED</span></td><td className="small">A check exists but has not been run.</td></tr>
            <tr><td><span className="status s-NOT-IMPLEMENTED">NOT IMPLEMENTED</span></td><td className="small">The capability to validate this does not exist yet.</td></tr>
          </tbody>
        </table>
      </div>
      <CrucibleRunner />
      <p className="small muted" style={{ marginTop: 14 }}>The Workbench and Dynamics Lab additionally run the Crucible’s input and conservation validators on every calculation. The same checks run in Node under <span className="mono">npm test</span>.</p>
    </>
  );
}
