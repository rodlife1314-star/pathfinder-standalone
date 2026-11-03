/**
 * Live ORION evaluation against the configured provider.
 *   node --env-file=.env.local scripts/orion-eval.ts     (or: npm run orion:eval)
 * Writes docs/evaluations/<timestamp>_<provider>_<model>.json (no credentials).
 * Without configuration it records nothing and reports NOT TESTED.
 * Each run makes one real, billable API call per case.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { readOrionConfig } from "../src/orion/model/config.ts";
import { runEvaluation } from "../src/orion/eval/runner.ts";
import { EVAL_CASES } from "../src/orion/eval/cases.ts";
import { redact } from "../src/orion/model/redact.ts";

const c = readOrionConfig(process.env);
if (!c.ok) {
  console.log(`LIVE INTEGRATION: NOT TESTED — ${c.error}`);
  process.exit(2);
}
console.log(`Running ${EVAL_CASES.length} cases against ${c.config.provider}:${c.config.model} (one billable call per case)…`);
const rec = await runEvaluation(c.config, { onProgress: (l) => console.log(redact(l, [c.config.apiKey])) });
const safe = redact(JSON.stringify(rec, null, 2), [c.config.apiKey]);
mkdirSync(new URL("../docs/evaluations/", import.meta.url), { recursive: true });
const name = `${rec.startedAt.replace(/[:.]/g, "-")}_${c.config.provider}_${c.config.model.replace(/[^A-Za-z0-9._-]/g, "_")}.json`;
writeFileSync(new URL(`../docs/evaluations/${name}`, import.meta.url), safe + "\n");
console.log(`\n${rec.summary.passed}/${rec.summary.cases} passed (${rec.summary.errors} call errors). Tokens in/out: ${rec.summary.inputTokens}/${rec.summary.outputTokens}. Record: docs/evaluations/${name}`);
