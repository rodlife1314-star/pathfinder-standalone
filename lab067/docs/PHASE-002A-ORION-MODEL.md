# Phase 002a — ORION language-model integration (development branch)

**Branch:** `lab067/orion-llm-dev` (from `lab067/phase-001` @ `1c8d067`).
**Status:** development only. **Not** promoted to Phase 002, **not** merged into the Phase 001 baseline.
**Authorisation:** Operator, 2026-11-03 — fetch-based client, server-side key, ORION as reasoning/hypothesis interface only,
timeouts, error handling, model identification, response tracing, failed-call tests, no credential logging, isolated branch.
**Review:** taken **before** Jemma's Phase 001 review; added to her review scope (§9). Not reviewed.

## What changed

| File | Purpose |
|---|---|
| `src/orion/model/config.ts` | Reads `ORION_*` env vars (server only). https-only base URL, bounded timeout/tokens/temperature. `publicDescriptor` is the only browser-safe view. |
| `src/orion/model/client.ts` | Plain `fetch` to `{base}/chat/completions`. AbortController timeout, no retries, error taxonomy: `timeout`, `network`, `auth` (401/403), `rate-limited` (429), `http`, `invalid-response`, `empty-response`. |
| `src/orion/model/redact.ts` | Redacts the configured key plus common credential shapes from every error message; truncates bodies to 500 chars. |
| `src/orion/model/prompt.ts` | Versioned system prompt (`orion-prompt/0.1.0`) stating the contract and requesting a JSON shape. The prompt is advisory; enforcement is in code. |
| `src/orion/model/admission.ts` | Parses output; routes it through the existing `admitOrionProposal` guard. Forbidden class / status fields → **REJECTED** (quarantined, not recordable). Non-JSON → kept, forced to UNVERIFIED_AI_EXPLANATION. Flags every sentence with a number and any validation/feasibility wording. |
| `src/orion/model/service.ts` | Orchestration + timestamped trace; returns `verification: UNVERIFIED, evaluatedByCrucible: false, calculationsPerformedByOrion: false` on every response. Raw output is hashed (SHA-256). |
| `app/api/orion/route.ts` | Server-only route. `GET` → public descriptor; `POST` → validated request (kind enum, 1–2000 chars). Server log on failure: kind, HTTP status, latency — never headers, key or body. |
| `src/ui/orion-console.tsx`, `src/ui/orion-model-panel.tsx` | Mode switch (templates / model; model disabled when unconfigured), unverified banner, numeric-claim and validation-language warnings, full call trace, record-to-ledger via the contract guard. |
| `.env.example`, `.gitignore` | Example config; all `.env*` files ignored except the example. |

Unchanged: physics, integration, materials, Crucible checks (one NOT IMPLEMENTED description reworded), ledger. ORION still cannot reach the engines or write anything but `orion-proposal`.

## Configure

```bash
cp .env.example .env.local      # git-ignored
# set ORION_API_KEY=... (never NEXT_PUBLIC_*)
npm run build && npm start
```

## Evidence

| Test | Result |
|---|---|
| `npm test` (Node v22.23.4) | **82 / 82 pass** (61 Phase 001 + 21 new). Log: `docs/phase-002a-test-output.txt` |
| Adapter failure modes (scripted fake HTTP) | timeout, network, 401/403, 429, 500/503, non-JSON, no choices, non-string content, empty content, oversized body — each classified correctly |
| Key leakage | Asserted absent from every result, error and descriptor; a 401 body echoing the key is redacted |
| Mutation check | Disabling redaction makes 3 tests fail; restored → pass |
| Browser, no key | Model mode disabled with reason "ORION_API_KEY is not set on the server" |
| Browser, dummy key → real NVIDIA host | **Real failure**: `network: fetch failed` (session network policy blocks the host). Error shown, no output claimed, no key in any browser-visible response, server log sanitised |
| Browser, local HTTPS stub | UI rendering of a success path only (fixture text, not model output): banner, sections, numeric flag on "9.11 > 9.8", model-mismatch warning, trace |

## NOT TESTED

- **Any real call to `integrate.api.nvidia.com` / `z-ai/glm-5.3-flash`.** The development session's network policy refuses the host. Real model behaviour, latency, JSON compliance and the provider's response headers are unknown.
- Whether `nvcf-reqid` / `x-request-id` headers are returned by the provider (read best-effort; shown as "—" if absent).

## Known limitations

- No rate limiting or request quota on `/api/orion`; anyone who can reach the server can spend the key's quota. Do not expose the dev server publicly.
- No retries and no streaming (by design: failures are reported, not hidden).
- Node's built-in `fetch` does not use `HTTPS_PROXY`; behind a corporate proxy the call fails as `network`.
- Prompt injection: Operator text is placed in the prompt. Impact is bounded because ORION has no tools or actions and its output is guarded, but the model can still produce misleading text.
- Numeric flagging is deliberately over-inclusive; validation-language detection is a keyword list, not understanding.
- Scientific correctness of model output is **not evaluated** (Crucible `orion.inference-engine`: NOT IMPLEMENTED).

## Security note

The API key shared in chat on 2026-11-03 should be considered exposed and rotated. It is not stored in this repository.
