import { CONCEPTS, CONCEPT_BY_ID } from "./concepts";
import { detectLondonBorough } from "./geo";
import type { ActiveConcept, ChallengeAnalysis } from "./types";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9&]+/g, " ").replace(/\s+/g, " ").trim();
}

export function analyzeChallenge(challenge: string): ChallengeAnalysis {
  const normalized = normalize(challenge);
  const padded = ` ${normalized} `;
  const tokens = new Set(normalized.split(" ").filter(Boolean));

  const direct = new Set<string>();
  for (const concept of CONCEPTS) {
    for (const alias of concept.aliases) {
      const a = alias.toLowerCase();
      const hit = a.includes(" ") ? padded.includes(` ${a} `) : tokens.has(a);
      if (hit) {
        direct.add(concept.id);
        break;
      }
    }
  }

  const expanded = new Set<string>();
  for (const id of direct) {
    const concept = CONCEPT_BY_ID.get(id);
    if (!concept) continue;
    for (const related of concept.related) {
      if (!direct.has(related)) expanded.add(related);
    }
  }

  const active: ActiveConcept[] = [];
  for (const id of direct) {
    const concept = CONCEPT_BY_ID.get(id);
    if (!concept) continue;
    active.push({ id, kind: concept.kind, label: concept.label, depth: "direct" });
  }
  for (const id of expanded) {
    const concept = CONCEPT_BY_ID.get(id);
    if (!concept) continue;
    active.push({ id, kind: concept.kind, label: concept.label, depth: "expanded" });
  }

  return {
    challenge,
    location: detectLondonBorough(padded),
    active,
  };
}

export function toAnalysis(input: string | ChallengeAnalysis): ChallengeAnalysis {
  return typeof input === "string" ? analyzeChallenge(input) : input;
}
