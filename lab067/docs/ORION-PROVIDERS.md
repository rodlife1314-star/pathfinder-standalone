# ORION model-provider replacement — evaluation, recommendation and adapter design

**Branch:** `lab067/phase-002-dev` · **Date:** 2026-11-03 · **Status:** development only, not merged, not reviewed.
**Authority:** Human Operator directive "ORION Model Replacement". The Operator retains final approval of the model.
**Nothing here grants ORION scientific authority.** All model output remains UNVERIFIED.

> **Conflict of interest.** This document was written by Claude (an Anthropic model), and one candidate
> family is Anthropic's. Weigh the recommendation in §3 accordingly. Its grounds are stated so they can be
> checked, and the live evaluation in §5 — not this document — should decide.

---

## 1. NVIDIA removal

Removed: the NVIDIA default endpoint and model, `src/orion/model/client.ts` (chat-completions client with
NVIDIA defaults), NVIDIA-specific redaction pattern, `docs/PHASE-002A-ORION-MODEL.md`, its test log, and
`test/orion-model.test.ts`. Kept and generalised: server-side key handling, timeouts, error taxonomy,
redaction, tracing, rate limiting, origin check, contract guard, and the generic OpenAI-compatible path
(now an explicit `openai-compatible` provider with **no default host**). No credentials are in the repository.

## 2. Candidates — documented facts only

Sources: Anthropic — bundled Claude API reference (cached 2026-10-06). OpenAI and Google — official-domain
search excerpts on 2026-11-03; **their documentation hosts could not be fetched from this session**, so
those rows carry lower confidence and must be re-checked by the Operator. No candidate has been called live.

| | **Claude Sonnet 5.5** | **Claude Opus 5.5** | **GPT-6.1 Sol** | **GPT-6 Astra** | **Gemini 4 Argon** |
|---|---|---|---|---|---|
| Model id | `claude-sonnet-5-5` | `claude-opus-5-5` | `gpt-6.1-sol` | `gpt-6-astra` | `gemini-4-argon` |
| Price in / out per 1M tokens | $2 / $10 | $4 / $20 | $2 / $10 | $10 / $50 | $2 / $10 until 30 Nov 2026, **$4 / $20 from 1 Dec 2026** |
| Reasoning tokens billed as | output (thinking billed even when not displayed) | output | output | output | output |
| Depth control | `output_config.effort` low…max (default high) | effort low…max (**default medium**); thinking cannot be disabled | `reasoning.effort` (no `none`; default medium) | `reasoning.effort` (no `none`) | `thinkingLevel` LOW/MEDIUM/HIGH (default MEDIUM) |
| Schema-enforced output | `output_config.format` json_schema | same | Responses `text.format` json_schema, `strict` | same | `responseJsonSchema` + `responseMimeType` — docs inconsistent (field marked deprecated in one reference) |
| Explicit refusal signal | `stop_reason: "refusal"` + category | same | `refusal` content item | same | `blockReason` / `finishReason: SAFETY` |
| Context / max output | 1M / 128K | 1M / 128K | not confirmed | long-context surcharge above 272K input | 1,048,576 / 1,048,576 |
| API stability notes | Messages API, versioned header `2026-10-21`; sampling params rejected | same | Responses API is OpenAI's current surface | same | Google labels `generateContent` "Legacy"; newer interface exists |
| Reachable from this build session | yes (unauthenticated 401) | yes | **no** (blocked) | **no** | **no** (proxy 403) |
| Adapter shape confidence | verified against current reference | same | search excerpts | same | search excerpts; field naming ambiguous |

Lower-cost tiers documented but not ranked here (capability for this task unmeasured): Claude Haiku 5.5
($0.10 / $0.50), GPT-6 Luna ($0.10 / $0.50), GPT-6.1 Terra ($1 / $5). They can be put through the same
evaluation; being cheap is not evidence that they are adequate, and neither is being "reasoning".

**What is not known:** how any of these models actually performs on ORION's tasks. Marketing labels,
benchmark claims and this table do not establish that. §5 is the only evidence that counts.

## 3. Recommendation (provisional — pending live evaluation)

| Role | Choice | Why |
|---|---|---|
| **Primary (provisional)** | **Anthropic `claude-sonnet-5-5`, effort `high`** | Tied lowest price among full-size candidates ($2/$10); schema-enforced output; explicit refusal signal; stable versioned API; adapter shape verified against current documentation; endpoint reachable from the cloud build environment, so the evaluation can run here once a key is provided. |
| **Fallback** | **OpenAI `gpt-6.1-sol`** | Same price; strict schema enforcement; a different vendor gives an independent failure domain and a cross-check on disputed answers. Adapter shape is lower-confidence until the Operator confirms it against OpenAI's docs. |
| Escalation (only if evaluation shows need) | `claude-opus-5-5` ($4/$20) or `gpt-6-astra` ($10/$50) | Use only if the primary fails reasoning cases that a larger model passes. |
| Not recommended now | `gemini-4-argon` | Not a capability judgement (unmeasured). Price doubles on 1 Dec 2026; endpoint labelled Legacy; structured-output field naming inconsistent in docs. Revisit after a live run. |

**Decision rule for the Operator:** run `npm run orion:eval` against each candidate under consideration.
Adopt the cheapest model and effort that (a) passes ≥ 9 of 10 cases, and (b) has **zero** contract failures —
no rejection, no fabricated citation, no validation language — across all cases. If both primary and fallback
pass, keep both configured and use the fallback only on primary failure.

## 4. Adapter design

```
            ┌─────────────── ORION (provider-independent) ────────────────┐
 query ───► │ prompt.ts ─► schema.ts ─► service.ts ─► admission.ts ─► trace │ ──► UI / eval
            └─────────────────────────────┬────────────────────────────────┘
                                          │ ReasoningRequest / ParsedCompletion  (providers/types.ts)
                     ┌────────────────────┼────────────────────┬─────────────────────┐
              anthropic.ts           openai.ts            gemini.ts        openai-compatible.ts
                     └────────────── transport.ts (fetch, timeout, errors, redaction) ─┘
```

- **Contract separation.** ORION's prompt, response schema, admission guard and trace live in `src/orion/model/`
  and never mention a vendor. A provider module only builds one HTTPS request and parses one response
  (`ProviderDefinition`). Adding a vendor = one file + one registry line; ORION, Crucible and physics are untouched.
- **Schema** (`orion-response-schema/0.2.0`): `evidenceClass` (HYPOTHESIS | UNVERIFIED_AI_EXPLANATION), `verdict`
  (SUPPORTED | CONTRADICTED_BY_ESTABLISHED_LAW | UNDETERMINED | NOT_APPLICABLE), `answerValues` (name, value, unit),
  `uncertainty`, `assumptions`, `openQuestions`, `proposedExperiments`, `sections`. Written in the strict-mode
  subset (closed objects, all fields required, no numeric/length constraints) — verified by test.
- **Defence in depth.** Provider-side enforcement is a convenience; `admission.ts` re-checks every field, records
  schema deviations, rejects contract breaches (never repairs), and flags numbers, validation language and
  URL/DOI-like strings.
- **No authority.** A provider receives only `{system, user, schema, limits}`. It has no tools, no ledger handle,
  no Crucible access, no hardware path. Ledger writes happen only from the UI through `recordOrionProposal`
  (contract guard → `orion-proposal` kind only). Every response carries `verification: UNVERIFIED`.
- **Configuration.** `ORION_PROVIDER` and `ORION_MODEL` have **no defaults** (Operator choice). Key in
  `ORION_API_KEY`, server-only. Effort validated per provider. Timeout 1–600 s (default 120 s, reasoning models are slow),
  output 256–64 000 tokens (default 16 000). No sampling parameters are sent (rejected by current reasoning APIs).
- **Retained hardening:** per-client rate limit, cross-origin refusal, no retries, redaction of Anthropic/OpenAI/Google/bearer key shapes.

## 5. Evaluation harness and executed evidence

`src/orion/eval/` — 10 reproducible cases (`orion-eval/0.1.0`): Euler dynamics (2), conservation laws (2),
dimensional analysis (2), uncertainty (1), deliberately false hypotheses (3: energy generation, static levitation
— Earnshaw, "9.11 > 9.8"). Every numerical reference is computed by the deterministic engine at load time.
Grading is deterministic (no model judges a model): verdict, numeric values with tolerance, schema conformance,
no validation language, no fabricated citations, stated uncertainty. Each record stores provider, model, effort,
limits, prompt/schema versions, input SHA-256, raw-output SHA-256, outputs, failures, latency and token usage —
never the key. Run: `npm run orion:eval` → `docs/evaluations/<time>_<provider>_<model>.json`.

| Evidence | Result |
|---|---|
| `npm test` | **98 / 98 pass** (`docs/phase-002-dev-test-output.txt`) |
| Provider request/response tests | Request shape and parsing for all 4 providers incl. refusal, truncation, safety-block — against fixtures transcribed from documented shapes (**not** live responses) |
| Transport failure tests | timeout, network, 401/403, 429, 5xx, non-JSON, oversized body; key redacted in every path |
| Grader tests | correct answers pass; sign error, wrong verdict, "9.11", fake DOI, missing uncertainty, validation language, unstructured output all fail — hand-written fixtures, **not** model capability |
| Mutation check | disabling Anthropic refusal handling → 2 tests fail; restored → pass |
| Import boundaries | physics, integration, Crucible, ledger, materials import nothing from providers or the model service |
| Browser | unconfigured: model mode disabled with reason; configured against local HTTPS stub: verdict, answer values, uncertainty and fake-DOI flag rendered; no key in any browser-visible response |
| **Live evaluation, every candidate** | **NOT TESTED.** No provider credentials are configured; OpenAI and Google hosts are blocked from this session. `npm run orion:eval` ran and reported NOT TESTED; no record was written. |

No simulated response is presented as evidence of model capability.

## 6. Cost implications (estimates, not measurements)

Per call ≈ 778 input tokens (system prompt 1 594 chars + schema 1 084 chars + average case 235 chars, at ~4
chars/token — a heuristic, not a tokenizer count). Output including reasoning is unknown until a live run;
two bands shown.

| Model | per call @1.5K out | per call @6K out | one eval run (10 calls) | 1 000 queries |
|---|---|---|---|---|
| Claude Sonnet 5.5 / GPT-6.1 Sol / Gemini 4 Argon (to 30 Nov) | $0.017 | $0.062 | $0.17–0.62 | $17–62 |
| Claude Opus 5.5 / Gemini 4 Argon (from 1 Dec) | $0.033 | $0.12 | $0.33–1.23 | $33–123 |
| GPT-6 Astra | $0.083 | $0.31 | $0.83–3.08 | $83–308 |
| Claude Haiku 5.5 / GPT-6 Luna | $0.0008 | $0.003 | $0.01–0.03 | $0.8–3 |

Reasoning depth (effort) is the main cost driver: reasoning tokens bill as output on every candidate. Measure
actual `usage` from the first live evaluation before setting a budget. OpenAI and Google also offer batch tiers at
roughly half price (not used — ORION is interactive).

## 7. To complete the evaluation (Operator actions)

1. Rotate any previously exposed keys. Create a key for each candidate under consideration.
2. Either run locally with `.env.local`, or in a cloud session add the key as an environment secret
   (`ORION_API_KEY`) and allow the provider host (`api.openai.com`, `generativelanguage.googleapis.com`) in the
   environment's network settings. `api.anthropic.com` is already reachable from this environment.
3. `ORION_PROVIDER=… ORION_MODEL=… npm run orion:eval` per candidate (≈ 10 billable calls each).
4. Review the records in `docs/evaluations/`, apply the decision rule in §3, and approve (or reject) a model.
