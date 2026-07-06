import { toAnalysis } from "./analyze";
import type { ChallengeAnalysis } from "./types";

export interface HypothesisRule {
  id: string;
  requires: string[];
  template: string;
}

export const HYPOTHESIS_RULES: HypothesisRule[] = [
  { id: "supply_vs_demand", requires: ["housing", "demand"], template: "Housing supply growth is slower than demand growth" },
  { id: "affordability_homelessness", requires: ["affordability", "homelessness"], template: "Affordability pressures are increasing homelessness" },
  { id: "population_vs_stock", requires: ["population", "housing"], template: "Population growth exceeds available housing stock" },
  { id: "ta_capacity", requires: ["temporary_accommodation", "demand"], template: "Rising demand is outpacing temporary accommodation capacity" },
  { id: "pipeline_shortfall", requires: ["supply", "housing"], template: "The housing delivery pipeline is insufficient to meet need" },
  { id: "cost_displacement", requires: ["affordability", "housing"], template: "Rising housing costs are pushing households into temporary accommodation" },
  { id: "economic_instability", requires: ["employment"], template: "Local employment and economic conditions are reducing housing stability" },
  { id: "income_gap", requires: ["income", "affordability"], template: "Falling real incomes are widening the affordability gap" },
  { id: "rates_vs_inflation", requires: ["interest_rates", "inflation"], template: "Central banks are holding interest rates high to keep inflation falling toward target" },
  { id: "policy_transmission", requires: ["interest_rates", "monetary_policy"], template: "Monetary policy is being kept restrictive while its effects pass through to prices with a lag" },
  { id: "disinflation_resilience", requires: ["inflation", "economy"], template: "Inflation is easing without a sharp contraction in economic output" },
  { id: "trade_balance", requires: ["trade", "economy"], template: "Shifts in trade flows are reshaping the wider economic outlook" },
];

export interface GeneratedHypothesis {
  template: string;
  requires: string[];
}

export function generateHypothesisDetails(
  input: string | ChallengeAnalysis,
  maxHypotheses = 5,
): GeneratedHypothesis[] {
  const analysis = toAnalysis(input);
  const activeIds = new Set(analysis.active.map(c => c.id));

  const hypotheses: GeneratedHypothesis[] = [];
  for (const rule of HYPOTHESIS_RULES) {
    if (rule.requires.every(id => activeIds.has(id))) {
      hypotheses.push({ template: rule.template, requires: rule.requires });
      if (hypotheses.length >= maxHypotheses) break;
    }
  }

  if (hypotheses.length < 2) {
    const topics = analysis.active.filter(c => c.kind === "topic").map(c => c.label);
    if (topics.length > 0) {
      hypotheses.push({
        template: `Trends in ${topics[0]} are driven by factors not yet captured in available signals`,
        requires: [],
      });
    }
    if (hypotheses.length < 2) {
      hypotheses.push({
        template: "The challenge requires broader evidence collection before hypotheses can be formed",
        requires: [],
      });
    }
  }

  return hypotheses.slice(0, maxHypotheses);
}

export function generateHypotheses(input: string | ChallengeAnalysis, maxHypotheses = 5): string[] {
  return generateHypothesisDetails(input, maxHypotheses).map(h => h.template);
}
