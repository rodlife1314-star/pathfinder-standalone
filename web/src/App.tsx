import { useState, useEffect, useCallback } from "react";
import {
  Terminal, Trash2, Check, ShieldCheck, X, Database,
  ChevronRight, AlertCircle, ExternalLink, Search, Globe,
} from "lucide-react";
import {
  runPathfinder,
  sourceNodeToDataset,
  SAMPLE_CATALOGUE,
  type PathfinderResult,
} from "@core";

// ─── colour tokens ────────────────────────────────────────────────────────────
const C = {
  bgBase:    "#0d0d0d",
  bgPanel:   "#161616",
  bgCard:    "#1e1e1e",
  bgInput:   "#141414",
  border:    "#2e2e2e",
  borderDim: "#222",
  teal:      "#14b8a6",
  tealDim:   "#14b8a644",
  tealBg:    "#0d2a1f",
  red:       "#ef4444",
  amber:     "#f59e0b",
  t1: "#4b5563",
  t2: "#6b7280",
  t3: "#9ca3af",
  t4: "#c4ccd6",
  t5: "#e8ecf0",
  t6: "#f5f7f9",
};

const mono = "'JetBrains Mono', monospace";
const serif = "'Cormorant Garamond', serif";
const sans = "'DM Sans', sans-serif";

const PATHFINDER_EXAMPLE = "Why is temporary accommodation pressure increasing in Newham?";

type AccessMethod = "webpage" | "csv" | "json" | "api" | "table" | "file" | "unknown";

interface InspectedNode {
  title: string;
  sourceCatalogue: string;
  authority: string;
  sourceUrl: string;
  accessMethod: AccessMethod;
  description: string;
  evidenceDomains: string[];
  tags: string[];
  inspectionWarnings: string[];
}

interface ApprovedSource extends InspectedNode {
  id: string;
}

// ─── API client (plain fetch — no codegen in the standalone repo) ─────────────
const API = "/api/pathfinder";

class ApiError extends Error {
  constructor(public status: number, public data: { error?: string } | null) {
    super(data?.error ?? `HTTP ${status}`);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API}${path}`, {
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  if (!resp.ok) {
    let data: { error?: string } | null = null;
    try { data = await resp.json(); } catch { /* non-JSON error body */ }
    throw new ApiError(resp.status, data);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json() as Promise<T>;
}

export default function App() {
  const [challenge, setChallenge] = useState(PATHFINDER_EXAMPLE);
  const [result, setResult] = useState<PathfinderResult | null>(null);

  // ── operator-added source nodes ──
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<InspectedNode | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [inspectError, setInspectError] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [approvedSources, setApprovedSources] = useState<ApprovedSource[]>([]);

  const refetchSources = useCallback(() => {
    api<ApprovedSource[]>("/sources")
      .then(setApprovedSources)
      .catch(() => { /* server unreachable — keep last known list */ });
  }, []);

  useEffect(() => { refetchSources(); }, [refetchSources]);

  const buildCatalogue = useCallback(
    () => [
      ...SAMPLE_CATALOGUE,
      ...approvedSources.map(s =>
        sourceNodeToDataset({
          id: s.id,
          title: s.title,
          sourceCatalogue: s.sourceCatalogue,
          authority: s.authority,
          sourceUrl: s.sourceUrl,
          description: s.description,
          evidenceDomains: s.evidenceDomains,
          tags: s.tags,
        }),
      ),
    ],
    [approvedSources],
  );

  const run = () => {
    const text = challenge.trim();
    if (!text) { setResult(null); return; }
    setResult(runPathfinder({ challenge: text }, { catalogue: buildCatalogue() }));
  };

  const inspect = () => {
    const target = url.trim();
    if (!target) return;
    setConfirmation(null);
    setApproveError(null);
    setInspectError(false);
    setInspecting(true);
    api<InspectedNode>("/sources/inspect", {
      method: "POST",
      body: JSON.stringify({ url: target }),
    })
      .then(node => setPreview(node))
      .catch(() => setInspectError(true))
      .finally(() => setInspecting(false));
  };

  const approve = () => {
    if (!preview) return;
    setApproveError(null);
    setAdding(true);
    api<ApprovedSource>("/sources", {
      method: "POST",
      body: JSON.stringify({
        title: preview.title,
        sourceCatalogue: preview.sourceCatalogue,
        authority: preview.authority,
        sourceUrl: preview.sourceUrl,
        accessMethod: preview.accessMethod,
        description: preview.description,
        evidenceDomains: preview.evidenceDomains,
        tags: preview.tags,
        inspectionWarnings: preview.inspectionWarnings,
      }),
    })
      .then(created => {
        setConfirmation(`${created.authority} added to the source catalogue.`);
        setApproveError(null);
        setPreview(null);
        setUrl("");
        refetchSources();
      })
      .catch((err: unknown) => {
        const e = err instanceof ApiError ? err : null;
        setApproveError(
          e?.data?.error ??
            "This source could not be added — it may already be catalogued.",
        );
      })
      .finally(() => setAdding(false));
  };

  const removeSource = (id: string) => {
    api<void>(`/sources/${id}`, { method: "DELETE" }).then(refetchSources);
  };

  const sectionLabel = (t: string) => (
    <div style={{ fontFamily: mono, fontSize: "9px", color: C.t2, letterSpacing: "0.15em", marginBottom: 10 }}>{t}</div>
  );

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "32px 24px", background: C.bgBase }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ padding: 24, background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 16 }}>
          <div style={{ fontFamily: mono, fontSize: "9px", color: C.t2, letterSpacing: "0.15em", marginBottom: 10 }}>PATHFINDER v0.1 · READ-ONLY REASONING</div>
          <h2 style={{ fontFamily: serif, fontSize: "24px", color: C.t6, fontWeight: 400, marginBottom: 6 }}>
            CHALLENGE <span style={{ color: C.t1 }}>//</span> RECOMMENDATION
          </h2>
          <p style={{ fontFamily: sans, fontSize: "12px", color: C.t3, lineHeight: 1.6, marginBottom: 16, maxWidth: 680 }}>
            State a challenge. Pathfinder extracts keywords, proposes hypotheses, identifies the evidence required, and recommends datasets from the source catalogue. Recommendations only — no ingestion, no writes.
          </p>
          <textarea
            value={challenge}
            onChange={e => setChallenge(e.target.value)}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(); }}
            placeholder="Why is temporary accommodation pressure increasing in Newham?"
            rows={3}
            style={{ width: "100%", resize: "vertical", background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 4, padding: "12px 14px", color: C.t5, fontFamily: sans, fontSize: "13px", lineHeight: 1.5, outline: "none", marginBottom: 12 }}
          />
          <button
            onClick={run}
            style={{ background: C.tealBg, border: `1px solid ${C.tealDim}`, borderRadius: 4, padding: "9px 22px", cursor: "pointer", fontFamily: mono, fontSize: "9px", color: C.teal, letterSpacing: "0.14em", display: "inline-flex", alignItems: "center", gap: 7 }}
          >
            <Terminal size={11} /> RUN PATHFINDER
          </button>
        </div>

        {/* ── operator-added source nodes ─────────────────────────────────────── */}
        <div style={{ padding: 24, background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 16 }}>
          <div style={{ fontFamily: mono, fontSize: "9px", color: C.t2, letterSpacing: "0.15em", marginBottom: 10 }}>OPERATOR SOURCES · INSPECT BEFORE INGEST</div>
          <h2 style={{ fontFamily: serif, fontSize: "22px", color: C.t6, fontWeight: 400, marginBottom: 6 }}>
            ADD SOURCE <span style={{ color: C.t1 }}>//</span> SCOUT &amp; APPROVE
          </h2>
          <p style={{ fontFamily: sans, fontSize: "12px", color: C.t3, lineHeight: 1.6, marginBottom: 16, maxWidth: 680 }}>
            Paste a catalogue URL. Pathfinder inspects it server-side and proposes a source node — it never ingests. You approve before it joins the catalogue, and any data pull is a separate, later decision.
          </p>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 280, background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 4, padding: "0 12px" }}>
              <Globe size={13} color={C.t2} style={{ flexShrink: 0 }} />
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") inspect(); }}
                placeholder="https://fred.stlouisfed.org/"
                style={{ flex: 1, background: "transparent", border: "none", padding: "11px 0", color: C.t5, fontFamily: mono, fontSize: "12px", outline: "none" }}
              />
            </div>
            <button
              onClick={inspect}
              disabled={!url.trim() || inspecting}
              style={{ background: C.tealBg, border: `1px solid ${C.tealDim}`, borderRadius: 4, padding: "9px 22px", cursor: url.trim() ? "pointer" : "not-allowed", opacity: url.trim() ? 1 : 0.5, fontFamily: mono, fontSize: "9px", color: C.teal, letterSpacing: "0.14em", display: "inline-flex", alignItems: "center", gap: 7 }}
            >
              <Search size={11} /> {inspecting ? "INSPECTING…" : "INSPECT SOURCE"}
            </button>
          </div>

          {inspectError && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#2a1414", border: `1px solid ${C.red}55`, borderRadius: 4, fontFamily: mono, fontSize: "10px", color: C.red, letterSpacing: "0.06em" }}>
              <AlertCircle size={12} /> INSPECTION FAILED — CHECK THE URL AND TRY AGAIN
            </div>
          )}

          {confirmation && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: C.tealBg, border: `1px solid ${C.tealDim}`, borderRadius: 4, fontFamily: mono, fontSize: "10px", color: C.teal, letterSpacing: "0.06em" }}>
              <Check size={12} /> {confirmation.toUpperCase()}
            </div>
          )}

          {/* preview card */}
          {preview && (
            <div style={{ marginTop: 14, padding: 18, background: C.bgCard, border: `1px solid ${C.tealDim}`, borderRadius: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
                <span style={{ fontFamily: mono, fontSize: "8px", color: C.amber, letterSpacing: "0.14em" }}>INSPECTED · PREVIEW ONLY · NOT YET ADDED</span>
                <button onClick={() => setPreview(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: C.t2, display: "flex" }}>
                  <X size={13} />
                </button>
              </div>
              <div style={{ fontFamily: serif, fontSize: "18px", color: C.t6, marginBottom: 8 }}>{preview.title}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px 18px", marginBottom: 12 }}>
                {([
                  ["AUTHORITY", preview.authority],
                  ["CATALOGUE", preview.sourceCatalogue],
                  ["ACCESS METHOD", preview.accessMethod.toUpperCase()],
                ] as const).map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontFamily: mono, fontSize: "8px", color: C.t2, letterSpacing: "0.12em", marginBottom: 3 }}>{k}</div>
                    <div style={{ fontFamily: sans, fontSize: "12px", color: C.t4 }}>{v}</div>
                  </div>
                ))}
              </div>
              {preview.description && (
                <p style={{ fontFamily: sans, fontSize: "12px", color: C.t3, lineHeight: 1.6, marginBottom: 12 }}>{preview.description}</p>
              )}
              {preview.evidenceDomains.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: mono, fontSize: "8px", color: C.t2, letterSpacing: "0.12em", marginBottom: 5 }}>EVIDENCE DOMAINS</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {preview.evidenceDomains.map(d => (
                      <span key={d} style={{ fontFamily: mono, fontSize: "9px", color: C.t4, background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 3, padding: "4px 8px" }}>{d}</span>
                    ))}
                  </div>
                </div>
              )}
              {preview.tags.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: mono, fontSize: "8px", color: C.t2, letterSpacing: "0.12em", marginBottom: 5 }}>REASONING TAGS</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {preview.tags.map(t => (
                      <span key={t} style={{ fontFamily: mono, fontSize: "9px", color: C.teal, background: C.tealBg, border: `1px solid ${C.tealDim}`, borderRadius: 3, padding: "4px 8px" }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {preview.inspectionWarnings.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: mono, fontSize: "8px", color: C.amber, letterSpacing: "0.12em", marginBottom: 5 }}>INSPECTION WARNINGS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {preview.inspectionWarnings.map((w, i) => (
                      <div key={i} style={{ display: "flex", gap: 7, alignItems: "baseline" }}>
                        <AlertCircle size={11} color={C.amber} style={{ flexShrink: 0, position: "relative", top: 2 }} />
                        <span style={{ fontFamily: sans, fontSize: "11px", color: C.t3, lineHeight: 1.5 }}>{w}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {approveError && (
                <div style={{ display: "flex", gap: 7, alignItems: "baseline", marginBottom: 12, padding: "9px 11px", background: "rgba(245,158,11,0.08)", border: `1px solid ${C.amber}`, borderRadius: 4 }}>
                  <AlertCircle size={11} color={C.amber} style={{ flexShrink: 0, position: "relative", top: 2 }} />
                  <span style={{ fontFamily: sans, fontSize: "11px", color: C.t4, lineHeight: 1.5 }}>{approveError}</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 12, borderTop: `1px solid ${C.borderDim}` }}>
                <button
                  onClick={approve}
                  disabled={adding}
                  style={{ background: C.tealBg, border: `1px solid ${C.tealDim}`, borderRadius: 4, padding: "9px 22px", cursor: "pointer", fontFamily: mono, fontSize: "9px", color: C.teal, letterSpacing: "0.14em", display: "inline-flex", alignItems: "center", gap: 7 }}
                >
                  <ShieldCheck size={11} /> {adding ? "ADDING…" : "ADD TO CATALOGUE"}
                </button>
                <button
                  onClick={() => setPreview(null)}
                  style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 4, padding: "9px 18px", cursor: "pointer", fontFamily: mono, fontSize: "9px", color: C.t3, letterSpacing: "0.14em" }}
                >
                  DISCARD
                </button>
                <span style={{ fontFamily: mono, fontSize: "8px", color: C.t1, letterSpacing: "0.08em" }}>ADDING THE SOURCE DOES NOT INGEST ANY DATA</span>
              </div>
            </div>
          )}

          {/* approved sources list */}
          {approvedSources.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontFamily: mono, fontSize: "8px", color: C.t2, letterSpacing: "0.12em", marginBottom: 8 }}>OPERATOR-APPROVED SOURCES · {approvedSources.length}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {approvedSources.map(s => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 12px", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <Database size={12} color={C.teal} style={{ flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: sans, fontSize: "13px", color: C.t5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
                        <div style={{ fontFamily: mono, fontSize: "8px", color: C.t2, letterSpacing: "0.08em", marginTop: 2 }}>{s.authority.toUpperCase()} · {s.accessMethod.toUpperCase()}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeSource(s.id)}
                      style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 3, padding: "5px 8px", cursor: "pointer", color: C.t3, display: "flex", flexShrink: 0 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: 20, background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4 }}>
              {sectionLabel("KEYWORDS")}
              {result.keywords.length === 0 ? (
                <div style={{ fontFamily: sans, fontSize: "12px", color: C.t2 }}>No keywords detected.</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {result.keywords.map(k => (
                    <span key={k} style={{ fontFamily: mono, fontSize: "10px", color: C.teal, letterSpacing: "0.08em", background: C.tealBg, border: `1px solid ${C.tealDim}`, borderRadius: 4, padding: "5px 10px" }}>{k}</span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: 20, background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4 }}>
              {sectionLabel("HYPOTHESES")}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {result.hypotheses.map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                    <span style={{ fontFamily: mono, fontSize: "9px", color: C.t2, flexShrink: 0, paddingTop: 2 }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ fontFamily: sans, fontSize: "13px", color: C.t4, lineHeight: 1.5 }}>{h}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: 20, background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4 }}>
              {sectionLabel("EVIDENCE REQUIRED")}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {result.evidenceRequired.map(e => (
                  <div key={e} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <ChevronRight size={12} color={C.t2} style={{ flexShrink: 0 }} />
                    <span style={{ fontFamily: sans, fontSize: "12px", color: C.t3 }}>{e}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: 20, background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4 }}>
              {sectionLabel("RECOMMENDED DATASETS")}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {result.recommendedDatasets.map(d => (
                  <div key={d.id} style={{ padding: "12px 14px", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <Database size={12} color={C.teal} style={{ flexShrink: 0 }} />
                        <span style={{ fontFamily: serif, fontSize: "15px", color: C.t5 }}>{d.title}</span>
                      </div>
                      <span style={{ fontFamily: mono, fontSize: "11px", color: C.teal, letterSpacing: "0.06em", flexShrink: 0 }}>CONF {d.score}</span>
                    </div>
                    <div style={{ height: 3, background: C.borderDim, borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ width: `${d.score}%`, height: "100%", background: C.teal }} />
                    </div>
                    {d.reason.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontFamily: mono, fontSize: "8px", color: C.t2, letterSpacing: "0.12em", marginBottom: 5 }}>REASON</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {d.reason.map((r, i) => (
                            <div key={i} style={{ display: "flex", gap: 7, alignItems: "baseline" }}>
                              <span style={{ color: C.teal, fontSize: "10px", flexShrink: 0, lineHeight: 1 }}>›</span>
                              <span style={{ fontFamily: sans, fontSize: "11px", color: C.t3 }}>{r}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingTop: 10, borderTop: `1px solid ${C.borderDim}` }}>
                      <span style={{ fontFamily: mono, fontSize: "8px", color: C.t2, letterSpacing: "0.1em" }}>SOURCE · {d.source.toUpperCase()}</span>
                      {d.url ? (
                        <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: "9px", color: C.teal, letterSpacing: "0.08em", textDecoration: "none", padding: "4px 10px", border: `1px solid ${C.tealDim}`, borderRadius: 3, background: C.tealBg }}>
                          OPEN DATASET <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span style={{ fontFamily: mono, fontSize: "8px", color: C.t1, letterSpacing: "0.08em" }}>NO DIRECT LINK</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
