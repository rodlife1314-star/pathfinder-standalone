export type ConceptKind = "topic" | "dimension";

export interface Concept {
  id: string;
  kind: ConceptKind;
  label: string;
  aliases: string[];
  related: string[];
  evidence: string[];
}

export type ActivationDepth = "direct" | "expanded";

export interface ActiveConcept {
  id: string;
  kind: ConceptKind;
  label: string;
  depth: ActivationDepth;
}

export interface ChallengeAnalysis {
  challenge: string;
  location: string | null;
  active: ActiveConcept[];
}

export interface DatasetSource {
  id: string;
  title: string;
  source: string;
  url?: string;
  coverage: string;
  tags: string[];
  evidenceProvided: string[];
  description: string;
}

export interface DatasetMatch {
  concepts: string[];
  evidence: string[];
}

export interface DatasetRecommendation {
  id: string;
  title: string;
  source: string;
  url?: string;
  score: number;
  reason: string[];
  matched: DatasetMatch;
}

export interface PathfinderInput {
  challenge: string;
}

export interface PathfinderOptions {
  catalogue?: DatasetSource[];
  minScore?: number;
  limit?: number;
  maxHypotheses?: number;
  maxEvidence?: number;
}

export interface PathfinderResult {
  challenge: string;
  keywords: string[];
  hypotheses: string[];
  evidenceRequired: string[];
  recommendedDatasets: DatasetRecommendation[];
}
