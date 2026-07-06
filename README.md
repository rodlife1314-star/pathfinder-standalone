# PATHFINDER

Operator-guided evidence navigation engine. State a challenge; Pathfinder
extracts keywords, proposes hypotheses, identifies the evidence required, and
recommends datasets from a curated source catalogue. Read-only reasoning — no
ingestion, no writes. See [DOCTRINE.md](./DOCTRINE.md).

## Stack

- **Core** (`src/core/`) — pure TypeScript reasoning engine: concept graph,
  keyword extraction, hypothesis rules, evidence requirements, dataset
  recommendation scoring, and source-node inspection.
- **Server** (`src/server/`) — Express 5 API: SSRF-guarded source inspection,
  operator source catalogue CRUD (PostgreSQL + Drizzle ORM).
- **Web** (`web/`) — React + Vite operator panel: challenge → recommendation
  flow and the inspect-before-ingest Add Source flow.

## Setup

```bash
npm install                 # or pnpm install
export DATABASE_URL=postgres://...   # any PostgreSQL database
npm run db:push             # create the pathfinder_sources table
```

## Run (development)

```bash
npm run dev        # API server on :3000 (PORT to override)
npm run dev:web    # Vite dev server on :5173, proxies /api to :3000
```

## Run (production)

```bash
npm run build      # typecheck + build web UI to web/dist
npm start          # serves API + built UI on :3000
```

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/pathfinder/sources/inspect` | Inspect a URL → proposed source node (no persistence) |
| GET | `/api/pathfinder/sources` | List operator-approved sources |
| POST | `/api/pathfinder/sources` | Approve + persist a source node (409 on duplicate authority/URL) |
| DELETE | `/api/pathfinder/sources/:id` | Remove a source |
| GET | `/api/healthz` | Health check |
