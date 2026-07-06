import { analyzeChallenge } from "./analyze";
import { extractKeywords } from "./keywords";
import { generateHypothesisDetails } from "./hypotheses";
import { identifyEvidenceRequirements } from "./evidence";
import { recommendDatasets } from "./recommend";
import type { PathfinderInput, PathfinderOptions, PathfinderResult } from "./types";

export function runPathfinder(input: PathfinderInput, options: PathfinderOptions = {}): PathfinderResult {
  const challenge = (input.challenge ?? "").trim();
  const analysis = analyzeChallenge(challenge);
  const hypothesisDetails = generateHypothesisDetails(analysis, options.maxHypotheses ?? 5);

  return {
    challenge,
    keywords: extractKeywords(analysis),
    hypotheses: hypothesisDetails.map(h => h.template),
    evidenceRequired: identifyEvidenceRequirements(analysis, options.maxEvidence ?? 8),
    recommendedDatasets: recommendDatasets(analysis, {
      catalogue: options.catalogue,
      minScore: options.minScore,
      limit: options.limit,
      hypotheses: hypothesisDetails,
    }),
  };
}
