import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import { db, pathfinderSourcesTable } from "../db";
import { inspectSource, CONCEPT_BY_ID } from "../core";
import type { SourceNode } from "../core";

const router: IRouter = Router();

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_REDIRECTS = 4;
const USER_AGENT =
  "Mozilla/5.0 (compatible; Pathfinder/0.1) source-inspector";

interface FetchResult {
  html: string | null;
  contentType: string | null;
  fetchStatus: number | null;
  fetchError: string | null;
}

// Classify an IP literal as private / loopback / link-local / reserved. Used to
// block SSRF against internal network resources and the cloud metadata endpoint.
function isBlockedIp(ip: string): boolean {
  const v = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (net.isIPv4(v)) {
    const [a, b] = v.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true; // CGNAT
    if (a !== undefined && a >= 224) return true; // multicast + reserved
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
  if (lower.startsWith("fe80")) return true; // link-local
  return false;
}

// Resolve a hostname and reject if any resolved address is non-public. Throws on
// blocked hosts so the caller surfaces a fetch error and falls back to registry.
async function assertPublicHost(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error("blocked non-public address");
    return;
  }
  const addrs = await dns.lookup(hostname, { all: true });
  if (addrs.length === 0) throw new Error("host could not be resolved");
  for (const a of addrs) {
    if (isBlockedIp(a.address)) throw new Error("blocked non-public address");
  }
}

// Read a response body but stop once MAX_HTML_BYTES have been received, so a
// large response cannot exhaust memory.
async function readCapped(resp: Response, max: number): Promise<string | null> {
  if (!resp.body) return null;
  const reader = resp.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (total < max) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(Buffer.from(value));
        total += value.length;
      }
    }
  } finally {
    try { await reader.cancel(); } catch { /* already closed */ }
  }
  return Buffer.concat(chunks).subarray(0, max).toString("utf8");
}

// Single server-side fetch of the candidate URL. Redirects are followed
// manually so every hop is SSRF-validated. Resilient: any failure resolves to a
// result that lets inspectSource fall back to the catalogue registry.
async function fetchCandidate(initialUrl: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let url = initialUrl;
    let resp: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("unsupported protocol");
      }
      await assertPublicHost(parsed.hostname);
      resp = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        },
      });
      const location = resp.headers.get("location");
      if (resp.status >= 300 && resp.status < 400 && location) {
        url = new URL(location, url).toString();
        continue;
      }
      break;
    }
    if (!resp) throw new Error("no response");
    const contentType = resp.headers.get("content-type");
    const html = await readCapped(resp, MAX_HTML_BYTES);
    return { html, contentType, fetchStatus: resp.status, fetchError: null };
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "request timed out"
        : err instanceof Error
          ? err.message
          : "unknown error";
    return { html: null, contentType: null, fetchStatus: null, fetchError: message };
  } finally {
    clearTimeout(timer);
  }
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\/\S+$/i.test(value.trim());
}

// Keep only tags that map to a real reasoning concept — unknown tags never
// contribute to recommendation scoring, so persisting them is misleading.
function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.filter((t): t is string => typeof t === "string" && CONCEPT_BY_ID.has(t)))];
}

type CatalogueRow = typeof pathfinderSourcesTable.$inferSelect;

// Normalize for duplicate comparison — the same canonical form the DB unique
// indexes use (lower-cased, trailing slashes trimmed).
function normUrl(u: string): string {
  return u.trim().replace(/\/+$/, "").toLowerCase();
}

function findDuplicate(
  rows: CatalogueRow[],
  authority: string,
  sourceUrl: string,
): CatalogueRow | undefined {
  const a = authority.trim().toLowerCase();
  const u = normUrl(sourceUrl);
  return rows.find(
    r =>
      (a !== "" && a !== "unknown" && r.authority.trim().toLowerCase() === a) ||
      normUrl(r.sourceUrl) === u,
  );
}

function conflictPayload(dup: CatalogueRow): { error: string; existing: CatalogueRow } {
  return {
    error: `"${dup.authority}" is already catalogued as "${dup.sourceCatalogue}". A source-node represents the authority — individual datasets and datalists beneath it are assets, not separate nodes.`,
    existing: dup,
  };
}

// Postgres unique-violation SQLSTATE, surfaced directly or wrapped by the driver.
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

// ─── inspect (no persistence, no ingestion) ────────────────────────────────────
router.post("/pathfinder/sources/inspect", async (req, res): Promise<void> => {
  const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  if (!isHttpUrl(url)) {
    res.status(400).json({ error: "A full http(s):// URL is required." });
    return;
  }

  const fetched = await fetchCandidate(url);
  const node = inspectSource({ url, ...fetched });

  req.log.info({ url, authority: node.authority, accessMethod: node.accessMethod }, "pathfinder source inspected");
  res.json(node);
});

// ─── list approved sources ─────────────────────────────────────────────────────
router.get("/pathfinder/sources", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(pathfinderSourcesTable)
    .orderBy(pathfinderSourcesTable.createdAt);
  res.json(rows);
});

// ─── approve + persist ─────────────────────────────────────────────────────────
router.post("/pathfinder/sources", async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const node: Partial<SourceNode> = b;

  if (!isHttpUrl(node.sourceUrl) || typeof node.title !== "string" || !node.title.trim()) {
    res.status(400).json({ error: "title and a valid sourceUrl are required." });
    return;
  }

  // ── duplicate-source guard ──────────────────────────────────────────────
  // Doctrine: a source-node represents an authority; datasets/datalists beneath
  // it are assets, not separate nodes. The fast in-memory check returns a clear
  // 409 for the normal sequential case; the DB unique indexes (normalized
  // authority + URL) are the race-safe backstop for concurrent approvals.
  const authority = node.authority ?? "Unknown";
  const before = await db.select().from(pathfinderSourcesTable);
  const dup = findDuplicate(before, authority, node.sourceUrl);
  if (dup) {
    req.log.info({ authority: dup.authority }, "pathfinder duplicate source rejected");
    res.status(409).json(conflictPayload(dup));
    return;
  }

  const id = randomUUID();
  try {
    const [row] = await db
      .insert(pathfinderSourcesTable)
      .values({
        id,
        title: node.title.trim(),
        sourceCatalogue: node.sourceCatalogue ?? "Unknown",
        authority,
        sourceUrl: node.sourceUrl,
        accessMethod: node.accessMethod ?? "unknown",
        description: node.description ?? "",
        evidenceDomains: Array.isArray(node.evidenceDomains) ? node.evidenceDomains : [],
        tags: normalizeTags(node.tags),
        createdBy: "operator",
        status: "approved",
        inspectionWarnings: Array.isArray(node.inspectionWarnings) ? node.inspectionWarnings : [],
      })
      .returning();

    if (!row) throw new Error("insert returned no row");
    req.log.info({ id, authority: row.authority }, "pathfinder source approved");
    res.status(201).json(row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      const now = await db.select().from(pathfinderSourcesTable);
      const raced = findDuplicate(now, authority, node.sourceUrl);
      req.log.info({ authority }, "pathfinder duplicate source rejected (db constraint)");
      if (raced) {
        res.status(409).json(conflictPayload(raced));
        return;
      }
    }
    throw err;
  }
});

// ─── delete ────────────────────────────────────────────────────────────────────
router.delete("/pathfinder/sources/:id", async (req, res): Promise<void> => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "id is required" });
    return;
  }
  await db.delete(pathfinderSourcesTable).where(eq(pathfinderSourcesTable.id, id));
  res.status(204).send();
});

export default router;
