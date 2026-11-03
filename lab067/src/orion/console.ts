/**
 * ORION Reasoning Console — transparent, non-autonomous (Phase 001).
 *
 * What it does: deterministic keyword matching of the Operator's text against
 * static, pre-written templates. What it does NOT do: run a language model,
 * perform calculations, verify anything, or act on its own. The trace says so.
 */
import { KNOWLEDGE, type KnowledgeTemplate } from "./knowledge.ts";
import type { OrionProposalKind, RawOrionOutput } from "./contract.ts";

export const ORION_CONSOLE_SCHEMA = "lab067.orion-console/0.1.0" as const;

export type OrionQueryKind = "scientific-question" | "explain-equation" | "list-assumptions" | "propose-experiment";

export interface OrionQuery {
  kind: OrionQueryKind;
  text: string;
}

export interface OrionResponse {
  schema: typeof ORION_CONSOLE_SCHEMA;
  query: OrionQuery;
  matched: boolean;
  templateId: string | null;
  title: string;
  evidenceClass: "UNVERIFIED_AI_EXPLANATION" | "HYPOTHESIS";
  sections: { heading: string; lines: readonly string[] }[];
  openQuestions: readonly string[];
  references: readonly string[];
  trace: string[];
  /** Always true in Phase 001 — stated explicitly so the UI can show it. */
  noModelExecuted: true;
  noCalculationPerformed: true;
}

const KIND_TO_PROPOSAL: Record<OrionQueryKind, OrionProposalKind> = {
  "scientific-question": "decompose-question",
  "explain-equation": "explain-equation",
  "list-assumptions": "explain-uncertainty",
  "propose-experiment": "suggest-numerical-experiment",
};

export function scoreTemplate(t: KnowledgeTemplate, text: string): { score: number; hits: string[] } {
  const s = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}|×. -]+/gu, " ")} `;
  const hits = t.keywords.filter((k) => {
    const kk = k.toLowerCase();
    return kk.length <= 2 ? s.includes(` ${kk} `) : s.includes(kk);
  });
  return { score: hits.length, hits };
}

export function askOrion(query: OrionQuery): OrionResponse {
  const trace = [
    `Query kind: ${query.kind}.`,
    "Method: keyword match against static templates in src/orion/knowledge.ts.",
  ];
  const ranked = KNOWLEDGE.map((t) => ({ t, ...scoreTemplate(t, query.text) })).filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.t.id.localeCompare(b.t.id));
  const base = { schema: ORION_CONSOLE_SCHEMA, query, noModelExecuted: true as const, noCalculationPerformed: true as const };

  if (ranked.length === 0) {
    trace.push("No template matched any keyword.", "No language model is connected; ORION cannot answer novel questions in Phase 001.");
    return {
      ...base, matched: false, templateId: null, title: "No matching template",
      evidenceClass: "UNVERIFIED_AI_EXPLANATION",
      sections: [{ heading: "Response", lines: [
        "ORION has no inference engine in Phase 001 and no template covers this question.",
        "You may record it as an open question in the Evidence Ledger.",
      ] }],
      openQuestions: [query.text.trim()], references: [], trace,
    };
  }

  const best = ranked[0]!;
  const t = best.t;
  trace.push(
    `Matched template "${t.id}" on keywords: ${best.hits.join(", ")}.`,
    ...(ranked.length > 1 ? [`Other candidates: ${ranked.slice(1).map((r) => `${r.t.id} (${r.score})`).join(", ")}.`] : []),
    "No language model executed. No calculation performed. Content is pre-written and unverified.",
  );
  const sections: OrionResponse["sections"] = [];
  switch (query.kind) {
    case "explain-equation":
      if (t.equations.length) sections.push({ heading: "Equations", lines: t.equations });
      sections.push({ heading: "Explanation", lines: t.explanation });
      break;
    case "list-assumptions":
      sections.push({ heading: "Assumptions", lines: t.assumptions.length ? t.assumptions : ["None recorded for this topic."] });
      break;
    case "propose-experiment":
      sections.push({ heading: "Proposed numerical experiments (HYPOTHESIS — not run)", lines: t.experiments.length ? t.experiments : ["No experiment template for this topic."] });
      break;
    default:
      sections.push({ heading: "Explanation", lines: t.explanation });
      if (t.equations.length) sections.push({ heading: "Relevant equations", lines: t.equations });
  }
  return {
    ...base, matched: true, templateId: t.id, title: t.title,
    evidenceClass: query.kind === "propose-experiment" ? "HYPOTHESIS" : "UNVERIFIED_AI_EXPLANATION",
    sections, openQuestions: t.openQuestions, references: t.references, trace,
  };
}

/** Convert a console response to a raw proposal for the contract guard (admitOrionProposal). */
export function responseToProposal(r: OrionResponse): RawOrionOutput {
  return {
    kind: KIND_TO_PROPOSAL[r.query.kind],
    evidenceClass: r.evidenceClass,
    content: [`Q: ${r.query.text}`, `Template: ${r.templateId ?? "none"}`, ...r.sections.flatMap((s) => [`${s.heading}:`, ...s.lines])].join("\n"),
    references: [...r.references],
  };
}
