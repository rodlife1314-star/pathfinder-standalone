import { toAnalysis } from "./analyze";
import { TOPIC_ORDER } from "./concepts";
import type { ChallengeAnalysis } from "./types";

export function extractKeywords(input: string | ChallengeAnalysis): string[] {
  const analysis = toAnalysis(input);
  const rank = (id: string): number => {
    const i = TOPIC_ORDER.indexOf(id);
    return i === -1 ? TOPIC_ORDER.length : i;
  };

  const topics = analysis.active
    .filter(c => c.kind === "topic")
    .sort((a, b) => {
      if (a.depth !== b.depth) return a.depth === "direct" ? -1 : 1;
      return rank(a.id) - rank(b.id);
    });

  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const topic of topics) {
    if (seen.has(topic.label)) continue;
    seen.add(topic.label);
    keywords.push(topic.label);
  }
  return keywords;
}
