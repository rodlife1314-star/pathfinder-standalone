import { toAnalysis } from "./analyze";
import { SAMPLE_CATALOGUE } from "./catalogue";
import { identifyEvidenceRequirements } from "./evidence";
import type { ChallengeAnalysis, DatasetRecommendation, DatasetSource } from "./types";

const WEIGHTS = {
  directTopic: 30,
  expandedTopic: 18,
  directDimension: 16,
  expandedDimension: 10,
  evidence: 20,
  location: 8,
};

// "housing" is the universal domain anchor — it appears in most hypotheses'
// required concepts and in most catalogue datasets, so matching it alone is
// not distinctive enough to claim hypothesis support. A dataset only "supports"
// a hypothesis when it matches a distinctive (non-anchor) required concept.
const GENERIC_CONCEPTS = new Set(["housing"]);

export interface RecommendOptions {
  catalogue?: DatasetSource[];
  minScore?: number;
  limit?: number;
  hypotheses?: { requires: string[] }[];
}

export function recommendDatasets(
  input: string | ChallengeAnalysis,
  options: RecommendOptions = {},
): DatasetRecommendation[] {
  const analysis = toAnalysis(input);
  const catalogue = options.catalogue ?? SAMPLE_CATALOGUE;
  const minScore = options.minScore ?? 30;
  const limit = options.limit ?? 8;

  const requiredEvidence = identifyEvidenceRequirements(analysis, 100);
  const requiredEvidenceLc = new Set(requiredEvidence.map(e => e.toLowerCase()));
  const activeById = new Map(analysis.active.map(c => [c.id, c]));

  const scored: DatasetRecommendation[] = catalogue.map(dataset => {
    let raw = 0;
    const matchedConcepts: string[] = [];
    const matchedConceptIds: string[] = [];

    for (const tag of dataset.tags) {
      const active = activeById.get(tag);
      if (!active) continue;
      if (active.kind === "topic") {
        raw += active.depth === "direct" ? WEIGHTS.directTopic : WEIGHTS.expandedTopic;
      } else {
        raw += active.depth === "direct" ? WEIGHTS.directDimension : WEIGHTS.expandedDimension;
      }
      matchedConcepts.push(active.label);
      matchedConceptIds.push(tag);
    }

    const matchedEvidence: string[] = [];
    for (const provided of dataset.evidenceProvided) {
      if (requiredEvidenceLc.has(provided.toLowerCase())) {
        raw += WEIGHTS.evidence;
        matchedEvidence.push(provided);
      }
    }

    const locationMatch =
      !!analysis.location && /london|borough/i.test(dataset.coverage);
    if (locationMatch) {
      raw += WEIGHTS.location;
    }

    const score = Math.max(0, Math.min(100, Math.round(raw)));

    const reason: string[] = [];
    if (options.hypotheses?.length) {
      options.hypotheses.forEach((h, i) => {
        const distinctive = h.requires.filter(id => !GENERIC_CONCEPTS.has(id));
        const target = distinctive.length > 0 ? distinctive : h.requires;
        if (target.some(id => matchedConceptIds.includes(id))) {
          reason.push(`Supports Hypothesis #${i + 1}`);
        }
      });
    }
    for (const concept of matchedConcepts) {
      reason.push(`Matches keyword: ${concept.toLowerCase()}`);
    }
    for (const evidence of matchedEvidence) {
      reason.push(`Required evidence: ${evidence}`);
    }
    if (locationMatch && analysis.location) {
      reason.push(`Covers location: ${analysis.location}`);
    }

    return {
      id: dataset.id,
      title: dataset.title,
      source: dataset.source,
      url: dataset.url,
      score,
      reason: [...new Set(reason)],
      matched: { concepts: matchedConcepts, evidence: matchedEvidence },
    };
  });

  return scored
    .filter(rec => rec.score >= minScore)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}
