import { toAnalysis } from "./analyze";
import { CONCEPT_BY_ID } from "./concepts";
import type { ChallengeAnalysis } from "./types";

export function identifyEvidenceRequirements(input: string | ChallengeAnalysis, maxEvidence = 8): string[] {
  const analysis = toAnalysis(input);

  const ordered = [...analysis.active].sort((a, b) => {
    if (a.depth === b.depth) return 0;
    return a.depth === "direct" ? -1 : 1;
  });

  const seen = new Set<string>();
  const evidence: string[] = [];
  for (const concept of ordered) {
    const definition = CONCEPT_BY_ID.get(concept.id);
    if (!definition) continue;
    for (const item of definition.evidence) {
      if (seen.has(item)) continue;
      seen.add(item);
      evidence.push(item);
    }
    if (evidence.length >= maxEvidence) break;
  }

  return evidence.slice(0, maxEvidence);
}
