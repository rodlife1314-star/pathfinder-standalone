/**
 * Runs the evaluation set sequentially against one configured provider and
 * returns a complete, credential-free record (inputs, outputs, failures, grades).
 */
import type { OrionModelConfig } from "../model/config.ts";
import { publicDescriptor } from "../model/config.ts";
import { askOrionModel, type OrionModelResponse } from "../model/service.ts";
import type { FetchLike } from "../providers/transport.ts";
import { LAB_VERSION } from "../../contracts/version.ts";
import { EVAL_CASES, EVAL_SET_VERSION, type EvalCase } from "./cases.ts";
import { gradeCase, type CaseGrade } from "./grade.ts";

export const EVAL_RECORD_SCHEMA = "lab067.orion-eval-record/0.1.0" as const;

export interface EvalRecord {
  schema: typeof EVAL_RECORD_SCHEMA;
  evalSetVersion: string;
  softwareVersion: string;
  startedAt: string;
  finishedAt: string;
  liveCall: boolean;
  configuration: ReturnType<typeof publicDescriptor> & { maxOutputTokens: number };
  results: { case: EvalCase; response: OrionModelResponse; grade: CaseGrade }[];
  summary: { cases: number; passed: number; failed: number; errors: number; byCategory: Record<string, { passed: number; total: number }>; totalLatencyMs: number; inputTokens: number; outputTokens: number };
}

export async function runEvaluation(config: OrionModelConfig, opts: { fetchImpl?: FetchLike; clock?: () => Date; cases?: readonly EvalCase[]; onProgress?: (line: string) => void } = {}): Promise<EvalRecord> {
  const clock = opts.clock ?? (() => new Date());
  const cases = opts.cases ?? EVAL_CASES;
  const startedAt = clock().toISOString();
  const results: EvalRecord["results"] = [];
  for (const c of cases) {
    const response = await askOrionModel(config, { kind: c.kind, text: c.prompt }, { fetchImpl: opts.fetchImpl, clock });
    const grade = gradeCase(c, response);
    results.push({ case: c, response, grade });
    opts.onProgress?.(`${grade.pass ? "PASS" : "FAIL"}  ${c.id}  ${grade.checks.filter((x) => !x.pass).map((x) => `${x.check}: ${x.detail}`).join(" | ")}`);
  }
  const byCategory: Record<string, { passed: number; total: number }> = {};
  for (const r of results) {
    const b = (byCategory[r.case.category] ??= { passed: 0, total: 0 });
    b.total++; if (r.grade.pass) b.passed++;
  }
  const sum = (f: (r: OrionModelResponse) => number | null | undefined) => results.reduce((s, r) => s + (f(r.response) ?? 0), 0);
  return {
    schema: EVAL_RECORD_SCHEMA, evalSetVersion: EVAL_SET_VERSION, softwareVersion: LAB_VERSION,
    startedAt, finishedAt: clock().toISOString(), liveCall: !opts.fetchImpl,
    configuration: { ...publicDescriptor(config), maxOutputTokens: config.maxOutputTokens },
    results,
    summary: {
      cases: results.length, passed: results.filter((r) => r.grade.pass).length, failed: results.filter((r) => !r.grade.pass).length,
      errors: results.filter((r) => r.response.outcome === "ERROR").length, byCategory,
      totalLatencyMs: sum((r) => r.call.latencyMs), inputTokens: sum((r) => r.call.usage?.inputTokens), outputTokens: sum((r) => r.call.usage?.outputTokens),
    },
  };
}
