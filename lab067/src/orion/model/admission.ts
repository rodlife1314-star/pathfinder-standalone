/**
 * Turn raw model text into an ORION response that respects the contract.
 *  - Parse the requested JSON shape (tolerating a ```json fence).
 *  - Unparseable output is kept as UNSTRUCTURED text, forced to UNVERIFIED_AI_EXPLANATION.
 *  - Any contract breach (forbidden class, validation claims, extra status fields)
 *    → REJECTED: content quarantined, not offered for recording.
 *  - Numerical statements are flagged as not computed by the deterministic engine.
 */
import { admitOrionProposal, OrionContractViolation } from "../contract.ts";
import type { OrionQueryKind } from "../console.ts";

export interface AdmittedSections {
  disposition: "ADMITTED" | "ADMITTED_UNSTRUCTURED" | "REJECTED";
  rejectionReason: string | null;
  evidenceClass: "UNVERIFIED_AI_EXPLANATION" | "HYPOTHESIS";
  title: string;
  sections: { heading: string; lines: string[] }[];
  assumptions: string[];
  openQuestions: string[];
  proposedExperiments: string[];
  numericalClaims: string[];
  validationLanguage: string[];
}

const KIND_MAP = {
  "scientific-question": "decompose-question",
  "explain-equation": "explain-equation",
  "list-assumptions": "explain-uncertainty",
  "propose-experiment": "suggest-numerical-experiment",
} as const;

const strArr = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 2000)).slice(0, 40) : []);

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

export function admitModelOutput(kind: OrionQueryKind, rawText: string): AdmittedSections {
  const parsed = extractJson(rawText);
  const allText = parsed && typeof parsed === "object" ? collectStrings(parsed).join("\n") : rawText;
  const numericalClaims = findNumericalClaims(allText);
  const validationLanguage = [...new Set([...allText.matchAll(VALIDATION_WORDS)].map((m) => m[0].toLowerCase()))];
  const base = { numericalClaims, validationLanguage };

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ...base, disposition: "ADMITTED_UNSTRUCTURED", rejectionReason: null,
      evidenceClass: "UNVERIFIED_AI_EXPLANATION", title: "Unstructured model output",
      sections: [{ heading: "Model output (not in the requested format)", lines: rawText.split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 80) }],
      assumptions: [], openQuestions: [], proposedExperiments: [],
    };
  }

  const p = parsed as Record<string, unknown>;
  const sections = Array.isArray(p.sections)
    ? p.sections.filter((s): s is Record<string, unknown> => !!s && typeof s === "object").slice(0, 20)
      .map((s) => ({ heading: typeof s.heading === "string" ? s.heading.slice(0, 200) : "Section", lines: strArr(s.lines) }))
    : [];
  const title = typeof p.title === "string" ? p.title.slice(0, 200) : "ORION response";

  // Contract gate — same guard as every other ORION path. Reject, never repair.
  try {
    const raw: Record<string, unknown> = {
      kind: KIND_MAP[kind],
      evidenceClass: p.evidenceClass,
      content: JSON.stringify({ title, sections }),
      references: [],
    };
    for (const k of ["status", "validated", "validationStatus"]) if (k in p) raw[k] = p[k];
    if ("requiresValidation" in p) raw.requiresValidation = p.requiresValidation;
    admitOrionProposal(raw);
  } catch (e) {
    if (!(e instanceof OrionContractViolation)) throw e;
    return {
      ...base, disposition: "REJECTED", rejectionReason: e.message,
      evidenceClass: "UNVERIFIED_AI_EXPLANATION", title: "Rejected by ORION contract guard",
      sections: [], assumptions: [], openQuestions: [], proposedExperiments: [],
    };
  }

  return {
    ...base, disposition: "ADMITTED", rejectionReason: null,
    evidenceClass: p.evidenceClass as AdmittedSections["evidenceClass"],
    title, sections,
    assumptions: strArr(p.assumptions), openQuestions: strArr(p.openQuestions), proposedExperiments: strArr(p.proposedExperiments),
  };
}
