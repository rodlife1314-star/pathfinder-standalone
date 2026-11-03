/**
 * Turn raw model text into an ORION response that respects the contract.
 * Provider-independent: runs identically whatever produced the text.
 *
 *  - Parse JSON (tolerating a ```json fence). Unparseable → ADMITTED_UNSTRUCTURED,
 *    forced to UNVERIFIED_AI_EXPLANATION, verdict UNDETERMINED.
 *  - Contract breach (forbidden class, validation/status fields, waived validation)
 *    → REJECTED: quarantined, not recordable. Reject, never repair.
 *  - Schema deviations (missing/mistyped fields) are recorded, not silently fixed.
 *  - Flags: numerical statements (not engine-computed), validation/feasibility
 *    language, and URL/DOI-like strings (possible fabricated citations).
 */
import { admitOrionProposal, OrionContractViolation } from "../contract.ts";
import type { OrionQueryKind } from "../console.ts";
import { ORION_RESPONSE_SCHEMA, VERDICTS, type Verdict } from "./schema.ts";

export interface AnswerValue { name: string; value: number; unit: string }

export interface AdmittedSections {
  disposition: "ADMITTED" | "ADMITTED_UNSTRUCTURED" | "REJECTED";
  rejectionReason: string | null;
  evidenceClass: "UNVERIFIED_AI_EXPLANATION" | "HYPOTHESIS";
  title: string;
  verdict: Verdict;
  sections: { heading: string; lines: string[] }[];
  answerValues: AnswerValue[];
  assumptions: string[];
  uncertainty: string[];
  openQuestions: string[];
  proposedExperiments: string[];
  schemaDeviations: string[];
  numericalClaims: string[];
  validationLanguage: string[];
  citationLike: string[];
}

const KIND_MAP = {
  "scientific-question": "decompose-question",
  "explain-equation": "explain-equation",
  "list-assumptions": "explain-uncertainty",
  "propose-experiment": "suggest-numerical-experiment",
} as const;

function collectStrings(x: unknown): string[] {
  if (typeof x === "string") return [x];
  if (Array.isArray(x)) return x.flatMap(collectStrings);
  if (x && typeof x === "object") return Object.values(x).flatMap(collectStrings);
  return [];
}

function extractJson(text: string): unknown {
  const t = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  const candidate = fenced ? fenced[1]! : t;
  try { return JSON.parse(candidate); } catch { /* fall through */ }
  const a = candidate.indexOf("{"), b = candidate.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(candidate.slice(a, b + 1)); } catch { /* ignore */ } }
  return null;
}

/**
 * Flag every sentence containing an ASCII number. Deliberately over-inclusive:
 * a false flag costs a glance; a missed one could let model arithmetic pass as
 * a result. (Unicode sub/superscripts such as I₁ or 4f¹⁰ are not ASCII digits.)
 */
export function findNumericalClaims(text: string): string[] {
  const out: string[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const s = sentence.replace(/^[\s"',{}\[\]]+|[\s"',{}\[\]]+$/g, "");
    if (/(?<![A-Za-z_])\d+(?:\.\d+)?/.test(s) && !out.includes(s)) out.push(s.slice(0, 240));
    if (out.length >= 20) break;
  }
  return out;
}

const VALIDATION_WORDS = /\b(validated|verified|proven|confirmed experimentally|experimentally confirmed|is feasible|will levitate|generates (free )?energy|perpetual)\b/gi;
const CITATION_LIKE = /\b(?:https?:\/\/\S+|doi:\s*\S+|10\.\d{4,9}\/\S+|arXiv:\s*\d{4}\.\d{4,5})/gi;

function strArr(x: unknown, field: string, dev: string[]): string[] {
  if (!Array.isArray(x)) { dev.push(`${field}: expected array`); return []; }
  const ok = x.filter((s): s is string => typeof s === "string");
  if (ok.length !== x.length) dev.push(`${field}: non-string items dropped`);
  return ok.map((s) => s.slice(0, 2000)).slice(0, 40);
}

const REQUIRED = ORION_RESPONSE_SCHEMA.required as readonly string[];

export function admitModelOutput(kind: OrionQueryKind, rawText: string): AdmittedSections {
  const parsed = extractJson(rawText);
  const isObj = !!parsed && typeof parsed === "object" && !Array.isArray(parsed);
  const allText = isObj ? collectStrings(parsed).join("\n") : rawText;
  const flags = {
    numericalClaims: findNumericalClaims(allText),
    validationLanguage: [...new Set([...allText.matchAll(VALIDATION_WORDS)].map((m) => m[0].toLowerCase()))],
    citationLike: [...new Set([...allText.matchAll(CITATION_LIKE)].map((m) => m[0]))].slice(0, 20),
  };
  const empty = { answerValues: [], assumptions: [], uncertainty: [], openQuestions: [], proposedExperiments: [] };

  if (!isObj) {
    return {
      ...flags, ...empty, disposition: "ADMITTED_UNSTRUCTURED", rejectionReason: null,
      evidenceClass: "UNVERIFIED_AI_EXPLANATION", title: "Unstructured model output", verdict: "UNDETERMINED",
      sections: [{ heading: "Model output (not in the requested format)", lines: rawText.split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 80) }],
      schemaDeviations: ["output is not a JSON object"],
    };
  }

  const p = parsed as Record<string, unknown>;
  const dev: string[] = [];
  for (const k of REQUIRED) if (!(k in p)) dev.push(`${k}: missing`);
  for (const k of Object.keys(p)) if (!REQUIRED.includes(k)) dev.push(`${k}: unexpected field`);

  // Contract gate — the same guard as every other ORION path.
  try {
    const raw: Record<string, unknown> = { kind: KIND_MAP[kind], evidenceClass: p.evidenceClass, content: JSON.stringify({ title: p.title }), references: [] };
    for (const k of ["status", "validated", "validationStatus"]) if (k in p) raw[k] = p[k];
    if ("requiresValidation" in p) raw.requiresValidation = p.requiresValidation;
    admitOrionProposal(raw);
  } catch (e) {
    if (!(e instanceof OrionContractViolation)) throw e;
    return {
      ...flags, ...empty, disposition: "REJECTED", rejectionReason: e.message, evidenceClass: "UNVERIFIED_AI_EXPLANATION",
      title: "Rejected by ORION contract guard", verdict: "UNDETERMINED", sections: [], schemaDeviations: dev,
    };
  }

  const verdict: Verdict = typeof p.verdict === "string" && (VERDICTS as readonly string[]).includes(p.verdict) ? (p.verdict as Verdict) : (dev.push("verdict: invalid → UNDETERMINED"), "UNDETERMINED");
  const sections = Array.isArray(p.sections)
    ? p.sections.filter((s): s is Record<string, unknown> => !!s && typeof s === "object").slice(0, 20)
      .map((s, i) => ({ heading: typeof s.heading === "string" ? s.heading.slice(0, 200) : `Section ${i + 1}`, lines: strArr(s.lines, `sections[${i}].lines`, dev) }))
    : (dev.push("sections: expected array"), []);
  const answerValues: AnswerValue[] = Array.isArray(p.answerValues)
    ? p.answerValues.flatMap((v, i) => {
      const o = v as Record<string, unknown>;
      if (o && typeof o.name === "string" && typeof o.value === "number" && Number.isFinite(o.value) && typeof o.unit === "string") return [{ name: o.name.slice(0, 120), value: o.value, unit: o.unit.slice(0, 40) }];
      dev.push(`answerValues[${i}]: invalid`); return [];
    }).slice(0, 20)
    : (dev.push("answerValues: expected array"), []);

  return {
    ...flags, disposition: "ADMITTED", rejectionReason: null,
    evidenceClass: p.evidenceClass as AdmittedSections["evidenceClass"],
    title: typeof p.title === "string" ? p.title.slice(0, 200) : "ORION response",
    verdict, sections, answerValues,
    assumptions: strArr(p.assumptions, "assumptions", dev),
    uncertainty: strArr(p.uncertainty, "uncertainty", dev),
    openQuestions: strArr(p.openQuestions, "openQuestions", dev),
    proposedExperiments: strArr(p.proposedExperiments, "proposedExperiments", dev),
    schemaDeviations: dev,
  };
}
