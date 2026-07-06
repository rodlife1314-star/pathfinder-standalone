import { analyzeChallenge } from "./analyze";
import type { DatasetSource } from "./types";

export const ACCESS_METHODS = ["webpage", "csv", "json", "api", "table", "file", "unknown"] as const;
export type AccessMethod = (typeof ACCESS_METHODS)[number];

export const SOURCE_NODE_STATUSES = ["inspected", "approved", "rejected"] as const;
export type SourceNodeStatus = (typeof SOURCE_NODE_STATUSES)[number];

export interface SourceNode {
  id: string;
  title: string;
  sourceCatalogue: string;
  authority: string;
  sourceUrl: string;
  accessMethod: AccessMethod;
  description: string;
  evidenceDomains: string[];
  tags: string[];
  createdBy: "operator";
  status: SourceNodeStatus;
  inspectionWarnings: string[];
}

export interface InspectSourceInput {
  url: string;
  html?: string | null;
  contentType?: string | null;
  fetchStatus?: number | null;
  fetchError?: string | null;
}

interface AuthorityProfile {
  authority: string;
  catalogue: string;
  description: string;
  evidenceDomains: string[];
  conceptTags: string[];
  accessMethod?: AccessMethod;
  warning?: string;
}

// Recognised authoritative catalogues. Matched by hostname suffix so that
// subdomains (api.*, fred.*) resolve to the same authority.
const AUTHORITY_REGISTRY: { match: string; profile: AuthorityProfile }[] = [
  {
    match: "stlouisfed.org",
    profile: {
      authority: "Federal Reserve Bank of St. Louis",
      catalogue: "FRED",
      description:
        "Federal Reserve Economic Data — a catalogue of U.S. and international economic time series covering monetary policy, prices, output and labour markets.",
      evidenceDomains: ["economics", "interest rates", "inflation", "employment", "monetary policy"],
      conceptTags: ["economy", "employment", "income", "inflation", "interest_rates", "monetary_policy"],
      accessMethod: "api",
    },
  },
  {
    match: "bls.gov",
    profile: {
      authority: "U.S. Bureau of Labor Statistics",
      catalogue: "BLS",
      description:
        "The principal U.S. federal agency for labour economics and statistics — employment, unemployment, wages, productivity and consumer prices (CPI inflation).",
      evidenceDomains: ["economics", "inflation", "employment", "income"],
      conceptTags: ["economy", "employment", "income", "inflation"],
    },
  },
  {
    match: "bea.gov",
    profile: {
      authority: "U.S. Bureau of Economic Analysis",
      catalogue: "BEA",
      description:
        "The U.S. national economic accounts agency — GDP, personal income, PCE inflation and international trade statistics.",
      evidenceDomains: ["economics", "income", "trade", "inflation"],
      conceptTags: ["economy", "income", "trade", "inflation"],
    },
  },
  {
    match: "bankofengland.co.uk",
    profile: {
      authority: "Bank of England",
      catalogue: "Bank of England",
      description:
        "The United Kingdom's central bank — monetary policy, the Bank Rate, inflation targeting and financial stability.",
      evidenceDomains: ["monetary policy", "interest rates", "inflation", "economics"],
      conceptTags: ["interest_rates", "monetary_policy", "inflation", "economy"],
    },
  },
  {
    match: "census.gov",
    profile: {
      authority: "U.S. Census Bureau",
      catalogue: "U.S. Census Bureau",
      description:
        "The U.S. federal statistical agency for population, housing, income and international trade data.",
      evidenceDomains: ["population", "housing", "income", "trade"],
      conceptTags: ["population", "housing", "income", "trade"],
    },
  },
  {
    match: "imf.org",
    profile: {
      authority: "International Monetary Fund",
      catalogue: "IMF",
      description:
        "Global macroeconomic and financial statistics — growth, inflation, interest rates, trade and balance of payments across member economies.",
      evidenceDomains: ["economics", "inflation", "interest rates", "trade"],
      conceptTags: ["economy", "inflation", "interest_rates", "trade", "employment"],
    },
  },
  {
    match: "data.london.gov.uk",
    profile: {
      authority: "Greater London Authority",
      catalogue: "London Datastore",
      description: "The GLA's open-data catalogue for London — boroughs, housing, population and economy datasets.",
      evidenceDomains: ["housing", "population", "economy"],
      conceptTags: ["housing", "population", "economy"],
      accessMethod: "webpage",
      warning: "London Datastore pages are Cloudflare-protected — inspection may rely on catalogue defaults.",
    },
  },
  {
    match: "ons.gov.uk",
    profile: {
      authority: "Office for National Statistics",
      catalogue: "ONS",
      description: "The UK's national statistics agency — population, economy, prices, employment and census data.",
      evidenceDomains: ["population", "economy", "inflation", "employment", "income"],
      conceptTags: ["population", "economy", "employment", "income"],
      accessMethod: "webpage",
    },
  },
  {
    match: "nomisweb.co.uk",
    profile: {
      authority: "Office for National Statistics (Nomis)",
      catalogue: "Nomis",
      description: "ONS labour market and census statistics service with a query and download API.",
      evidenceDomains: ["employment", "population", "income"],
      conceptTags: ["employment", "population", "income"],
      accessMethod: "api",
    },
  },
  {
    match: "gov.uk",
    profile: {
      authority: "UK Government",
      catalogue: "GOV.UK",
      description: "Official UK Government statistics and open data publications.",
      evidenceDomains: ["economy", "housing", "income"],
      conceptTags: ["economy", "housing", "income"],
      accessMethod: "webpage",
    },
  },
  {
    match: "worldbank.org",
    profile: {
      authority: "World Bank",
      catalogue: "World Bank Open Data",
      description: "Global development indicators covering economies, population, poverty and employment.",
      evidenceDomains: ["economics", "population", "employment", "income"],
      conceptTags: ["economy", "population", "employment", "income"],
      accessMethod: "api",
    },
  },
  {
    match: "oecd.org",
    profile: {
      authority: "OECD",
      catalogue: "OECD Data",
      description: "Comparative economic and social statistics across OECD member economies.",
      evidenceDomains: ["economics", "employment", "income", "inflation"],
      conceptTags: ["economy", "employment", "income"],
      accessMethod: "api",
    },
  },
  {
    match: "ec.europa.eu",
    profile: {
      authority: "European Commission (Eurostat)",
      catalogue: "Eurostat",
      description: "The statistical office of the European Union — economy, population and labour-market data.",
      evidenceDomains: ["economics", "population", "employment"],
      conceptTags: ["economy", "population", "employment"],
      accessMethod: "api",
    },
  },
  {
    match: "ourworldindata.org",
    profile: {
      authority: "Our World in Data",
      catalogue: "Our World in Data",
      description: "Research and data on global living conditions — economy, population, health and more.",
      evidenceDomains: ["economics", "population"],
      conceptTags: ["economy", "population"],
      accessMethod: "webpage",
    },
  },
];

// Domain vocabulary used to detect evidence domains from page text. This is a
// descriptive layer independent of the (housing-focused) reasoning concept
// graph, so sources outside housing still report meaningful domains.
const DOMAIN_LEXICON: { domain: string; terms: string[] }[] = [
  { domain: "economics", terms: ["economic", "economy", "gdp", "gva", "macroeconomic", "output"] },
  { domain: "inflation", terms: ["inflation", "consumer price", "cpi", "price index", "deflation"] },
  { domain: "interest rates", terms: ["interest rate", "federal funds", "yield", "bond rate", "policy rate"] },
  { domain: "monetary policy", terms: ["monetary policy", "federal reserve", "central bank", "money supply"] },
  { domain: "employment", terms: ["employment", "unemployment", "jobs", "labour market", "labor market", "payroll"] },
  { domain: "income", terms: ["income", "wages", "earnings", "salary", "household income"] },
  { domain: "housing", terms: ["housing", "dwelling", "homes", "accommodation", "house price"] },
  { domain: "population", terms: ["population", "demographic", "census", "residents", "migration"] },
  { domain: "trade", terms: ["trade", "imports", "exports", "balance of payments"] },
  { domain: "health", terms: ["health", "mortality", "morbidity", "life expectancy"] },
  { domain: "education", terms: ["education", "schools", "attainment", "literacy"] },
];

// Detected-domain → reasoning concept-ID map. Only concepts present in the
// concept graph are usable for recommendation scoring.
const DOMAIN_TO_CONCEPT: Record<string, string[]> = {
  economics: ["economy"],
  inflation: ["inflation"],
  "interest rates": ["interest_rates"],
  "monetary policy": ["monetary_policy"],
  employment: ["employment"],
  income: ["income"],
  housing: ["housing"],
  population: ["population"],
  trade: ["trade"],
  health: [],
  education: [],
};

function hostnameOf(url: string): string | null {
  const m = url.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i);
  if (!m) return null;
  const host = m[1].split("@").pop() ?? m[1];
  return host.replace(/:\d+$/, "").toLowerCase().replace(/^www\./, "");
}

function pathnameOf(url: string): string {
  const m = url.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+([^?#]*)/i);
  return (m?.[1] ?? "").toLowerCase();
}

function lookupAuthority(hostname: string): AuthorityProfile | null {
  for (const entry of AUTHORITY_REGISTRY) {
    if (hostname === entry.match || hostname.endsWith(`.${entry.match}`)) return entry.profile;
  }
  return null;
}

function deriveAuthorityName(hostname: string): string {
  const core = hostname.split(".").slice(0, -1).join(" ") || hostname;
  return core
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`,
      "i",
    );
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`,
      "i",
    );
    const m2 = html.match(re2);
    if (m2?.[1]) return m2[1].trim();
  }
  return null;
}

function extractTitle(html: string): string | null {
  const og = extractMeta(html, ["og:title", "twitter:title"]);
  if (og) return og;
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (m?.[1]) {
    // Drop trailing "| Site Name" / "- Site Name" suffixes.
    return m[1].split(/\s[|\u2013\u2014-]\s/)[0].trim();
  }
  return null;
}

// Detect when a *specific* URL points at a downloadable file or export rather
// than the authority's general API or webpage. This takes precedence over an
// authority's registered accessMethod, so e.g. FRED's `/download` endpoint is
// reported honestly as a file, not "api". Deliberately conservative: it only
// fires on explicit file extensions, `/download` paths, download/export query
// flags, or binary content-types — never on bare `application/json`, which a
// genuine API legitimately returns.
function detectDownloadMethod(input: InspectSourceInput): AccessMethod | null {
  const ct = (input.contentType ?? "").toLowerCase();
  const url = input.url.toLowerCase();
  const path = pathnameOf(input.url);

  if (ct.includes("text/csv") || /\.csv($|\?)/.test(path)) return "csv";
  if (/\.(xlsx?|ods)($|\?)/.test(path)) return "table";
  if (/\.json($|\?)/.test(path)) return "json";
  if (/\.(zip|gz|tgz|tar|pdf|txt|tsv|xml)($|\?)/.test(path)) return "file";
  if (/\/downloads?(\/|$)/.test(path)) return "file";
  if (/[?&](download|export)=/.test(url)) return "file";
  if (ct.includes("application/octet-stream") || ct.includes("application/zip")) return "file";
  return null;
}

function detectAccessMethod(input: InspectSourceInput, hostname: string): AccessMethod {
  const ct = (input.contentType ?? "").toLowerCase();
  const path = pathnameOf(input.url) || input.url.toLowerCase();

  if (ct.includes("text/csv") || /\.csv($|\?)/.test(path)) return "csv";
  if (ct.includes("application/json") || /\.json($|\?)/.test(path)) return "json";
  if (/\.(xlsx?|ods)($|\?)/.test(path)) return "table";
  if (hostname.startsWith("api.") || /\/api(\/|$|\?)/.test(path)) return "api";
  if (ct.includes("text/html") || /\.html?($|\?)/.test(path)) return "webpage";
  if (input.html && input.html.length > 0) return "webpage";
  return "unknown";
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

/**
 * Inspect a candidate source from its URL and (optionally) fetched HTML.
 * Pure function — the caller performs the single network fetch and passes the
 * result in. Returns a preview SourceNode with status "inspected". No data is
 * ingested; this is metadata inspection only.
 */
export function inspectSource(input: InspectSourceInput): SourceNode {
  const warnings: string[] = [];
  const hostname = hostnameOf(input.url);

  if (!hostname) {
    return {
      id: "",
      title: input.url || "Untitled source",
      sourceCatalogue: "Unknown",
      authority: "Unknown",
      sourceUrl: input.url,
      accessMethod: "unknown",
      description: "",
      evidenceDomains: [],
      tags: [],
      createdBy: "operator",
      status: "inspected",
      inspectionWarnings: ["URL could not be parsed — provide a full https:// address."],
    };
  }

  const profile = lookupAuthority(hostname);
  const html = input.html ?? "";

  if (input.fetchError) {
    warnings.push(`Source could not be fetched (${input.fetchError}) — metadata derived from the catalogue registry.`);
  } else if (typeof input.fetchStatus === "number" && input.fetchStatus >= 400) {
    warnings.push(`Source returned HTTP ${input.fetchStatus} — metadata may be incomplete.`);
  }

  // A per-URL file/download signal overrides the authority's registered access
  // method — the registry describes the catalogue in general, but this exact URL
  // may be a bulk export beneath it.
  const accessMethod =
    detectDownloadMethod(input) ?? profile?.accessMethod ?? detectAccessMethod(input, hostname);

  const authority = profile?.authority ?? deriveAuthorityName(hostname);
  const catalogue = profile?.catalogue ?? hostname;

  const pageTitle = html ? extractTitle(html) : null;
  const title = pageTitle || profile?.catalogue || deriveAuthorityName(hostname);

  const pageDescription = html ? extractMeta(html, ["description", "og:description", "twitter:description"]) : null;
  const bodyText = html ? stripTags(html).slice(0, 4000) : "";
  const description = (pageDescription || profile?.description || "").slice(0, 600);

  // Evidence domains: authority defaults ∪ lexicon hits across title/desc/body.
  const haystack = `${title} ${pageDescription ?? ""} ${bodyText}`.toLowerCase();
  const lexiconDomains = DOMAIN_LEXICON.filter(d => d.terms.some(t => haystack.includes(t))).map(d => d.domain);
  const evidenceDomains = dedupe([...(profile?.evidenceDomains ?? []), ...lexiconDomains]).slice(0, 8);

  // Concept tags (for recommendation scoring): authority concept tags ∪
  // concepts mapped from detected domains ∪ concepts the reasoning graph
  // directly recognises in the page text.
  const mappedConcepts = evidenceDomains.flatMap(d => DOMAIN_TO_CONCEPT[d] ?? []);
  const graphConcepts = analyzeChallenge(`${title} ${description} ${evidenceDomains.join(" ")}`).active
    .filter(c => c.depth === "direct")
    .map(c => c.id);
  const tags = dedupe([...(profile?.conceptTags ?? []), ...mappedConcepts, ...graphConcepts]);

  if (profile?.warning) warnings.push(profile.warning);
  if (!profile && !pageTitle && !input.fetchError) {
    warnings.push("Source is not in the catalogue registry — verify authority and access method before approving.");
  }
  if (accessMethod === "unknown") {
    warnings.push("Access method could not be determined from the URL or content type.");
  } else if (accessMethod === "webpage") {
    warnings.push("Source is a catalogue/webpage — individual datasets must be selected and ingested separately.");
  } else if (accessMethod === "file" || accessMethod === "csv" || accessMethod === "table") {
    warnings.push("Source is a direct file/export download — ingest by fetching the file itself, not via the authority's API.");
  }
  if (evidenceDomains.length === 0) {
    warnings.push("No evidence domains detected — add tags manually or the source will rarely surface.");
  }
  if (tags.length === 0) {
    warnings.push("No reasoning-graph concepts matched — source will not surface in recommendations until the graph covers its domain.");
  }

  return {
    id: "",
    title,
    sourceCatalogue: catalogue,
    authority,
    sourceUrl: input.url,
    accessMethod,
    description,
    evidenceDomains,
    tags,
    createdBy: "operator",
    status: "inspected",
    inspectionWarnings: dedupe(warnings),
  };
}

export interface SourceNodeLike {
  id: string;
  title: string;
  sourceCatalogue: string;
  authority: string;
  sourceUrl: string;
  description: string;
  evidenceDomains: string[];
  tags: string[];
}

/**
 * Convert an approved SourceNode into a DatasetSource so it can participate in
 * Pathfinder recommendations alongside the built-in catalogue.
 */
export function sourceNodeToDataset(node: SourceNodeLike): DatasetSource {
  return {
    id: node.id,
    title: node.title,
    source: node.sourceCatalogue,
    url: node.sourceUrl || undefined,
    coverage: node.authority,
    tags: node.tags,
    evidenceProvided: node.evidenceDomains,
    description: node.description,
  };
}
