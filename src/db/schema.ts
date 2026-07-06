import { pgTable, text, timestamp, json, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const PATHFINDER_ACCESS_METHODS = [
  "webpage", "csv", "json", "api", "table", "file", "unknown",
] as const;

export const PATHFINDER_SOURCE_STATUSES = [
  "inspected", "approved", "rejected",
] as const;

export type PathfinderAccessMethod = (typeof PATHFINDER_ACCESS_METHODS)[number];
export type PathfinderSourceStatus = (typeof PATHFINDER_SOURCE_STATUSES)[number];

export const pathfinderSourcesTable = pgTable("pathfinder_sources", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  sourceCatalogue: text("source_catalogue").notNull(),
  authority: text("authority").notNull(),
  sourceUrl: text("source_url").notNull(),
  accessMethod: text("access_method").notNull().$type<PathfinderAccessMethod>(),
  description: text("description").notNull().default(""),
  evidenceDomains: json("evidence_domains").$type<string[]>().notNull(),
  tags: json("tags").$type<string[]>().notNull(),
  createdBy: text("created_by").notNull().default("operator"),
  status: text("status").notNull().default("approved").$type<PathfinderSourceStatus>(),
  inspectionWarnings: json("inspection_warnings").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  // Race-safe duplicate guard. Doctrine: a source-node represents an authority;
  // datasets/datalists beneath it are assets, not separate nodes. One node per
  // authority (excluding the generic "unknown" fallback) and per normalized URL.
  uniqueIndex("pathfinder_sources_authority_uq")
    .on(sql`lower(trim(${t.authority}))`)
    .where(sql`lower(trim(${t.authority})) <> 'unknown' and trim(${t.authority}) <> ''`),
  uniqueIndex("pathfinder_sources_url_uq")
    .on(sql`lower(rtrim(${t.sourceUrl}, '/'))`),
]);

export type PathfinderSource = typeof pathfinderSourcesTable.$inferSelect;
export type InsertPathfinderSource = typeof pathfinderSourcesTable.$inferInsert;
