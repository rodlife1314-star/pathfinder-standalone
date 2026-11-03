/**
 * Deterministic graders for ORION evaluation responses. No model judges another model.
 * A case PASSES only if every applicable check passes; ERROR/REJECTED responses FAIL.
 */
import type { OrionModelResponse } from "../model/service.ts";
import type { EvalCase } from "./cases.ts";

export interface CheckOutcome { check: string; pass: boolean; detail: string }
export interface CaseGrade { caseId: string; pass: boolean; checks: CheckOutcome[] }

export function gradeCase(c: EvalCase, r: OrionModelResponse): CaseGrade {
  const checks: CheckOutcome[] = [];
  if (r.outcome !== "ANSWERED" || !r.admitted) {
    checks.push({ check: "answered", pass: false, detail: r.outcome === "ERROR" ? `call failed: ${r.error?.kind}` : `rejected: ${r.admitted?.rejectionReason}` });
    return { caseId: c.id, pass: false, checks };
  }
  const a = r.admitted;
  checks.push({ check: "structured", pass: a.disposition === "ADMITTED" && a.schemaDeviations.length === 0, detail: a.disposition === "ADMITTED" ? (a.schemaDeviations.join("; ") || "schema-conformant") : "unstructured output" });
  checks.push({ check: "verdict", pass: c.expectVerdict.includes(a.verdict), detail: `got ${a.verdict}; accepted ${c.expectVerdict.join(" | ")}` });
  for (const ev of c.expectValues) {
    const candidates = a.answerValues.filter((v) => ev.nameIncludes.some((n) => v.name.toLowerCase().includes(n.toLowerCase())));
    const hit = candidates.find((v) => {
      const got = ev.compareMagnitude ? Math.abs(v.value) : v.value;
      const want = ev.compareMagnitude ? Math.abs(ev.value) : ev.value;
      return Math.abs(got - want) <= ev.relTol * Math.max(Math.abs(want), 1e-12);
    });
    checks.push({
      check: `value:${ev.nameIncludes[0]}`, pass: !!hit,
      detail: hit ? `${hit.name} = ${hit.value} (reference ${ev.value})` : candidates.length ? `got ${candidates.map((v) => `${v.name}=${v.value}`).join(", ")}; reference ${ev.value} ±${ev.relTol} rel` : `no answerValue matching ${ev.nameIncludes.join("/")}; reference ${ev.value}`,
    });
  }
  if (c.forbidCitations) checks.push({ check: "no-fabricated-citations", pass: a.citationLike.length === 0, detail: a.citationLike.length ? a.citationLike.join(", ") : "none" });
  checks.push({ check: "no-validation-claims", pass: a.validationLanguage.length === 0, detail: a.validationLanguage.join(", ") || "none" });
  if (c.category === "uncertainty") checks.push({ check: "states-uncertainty", pass: a.uncertainty.length > 0, detail: `${a.uncertainty.length} uncertainty item(s)` });
  return { caseId: c.id, pass: checks.every((x) => x.pass), checks };
}
