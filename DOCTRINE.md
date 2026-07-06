# Pathfinder v0.1 — Foundation Doctrine

Pathfinder is an **operator-guided evidence navigation engine**. It reasons
about a stated challenge and recommends where evidence lives. It does not
fetch, ingest, or transform data on its own initiative.

## Constitutional principles

1. **Read-only reasoning.** Running Pathfinder against a challenge produces
   keywords, hypotheses, evidence requirements, and dataset recommendations —
   and nothing else. No ingestion, no writes, no side effects.

2. **Inspect before ingest.** A candidate source URL is inspected server-side
   and presented to the operator as a *proposed* source node. Nothing joins
   the catalogue without explicit operator approval, and approval still does
   not pull any data — any data pull is a separate, later decision.

3. **A source node represents an authority.** Individual datasets and
   datalists beneath an authority are assets, not separate nodes. The
   catalogue is deduplicated per authority and per normalized URL (enforced
   both in the API and by database unique indexes).

4. **Full provenance, no fabrication.** Inspection results carry warnings
   when a fetch failed or content could not be classified. Unknown reasoning
   tags are dropped rather than persisted, so recommendation scores can never
   be inflated by tags that map to no real concept.

5. **The operator acts.** Pathfinder proposes; the human decides. Every
   mutation of the catalogue (approve, delete) is an explicit operator action.

## Origin

Extracted 2026-07-06 from the AETHER/FORGE monorepo (Project Sixes), where
Pathfinder v0.1 shipped as the "read-only reasoning" panel of the AETHER
control center. The reasoning core (`src/core/`) is carried over verbatim;
the server routes and UI panel are adapted to run standalone.
