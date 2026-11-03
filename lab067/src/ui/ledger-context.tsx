"use client";
/**
 * In-browser evidence-ledger session. NON-PERSISTENT: the ledger lives in this
 * tab's memory and is lost on reload or close. It survives client-side
 * navigation between sections only.
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { EvidenceLedger, type LedgerAuthor, type LedgerEntry, type LedgerKind } from "../ledger/ledger.ts";

interface LedgerApi {
  entries: readonly LedgerEntry[];
  append: (author: LedgerAuthor, kind: LedgerKind, payload: unknown) => LedgerEntry;
  /** For guarded writers (e.g. recordOrionProposal) that take the ledger itself. */
  appendWith: (writer: (l: EvidenceLedger) => LedgerEntry) => LedgerEntry;
  ledger: EvidenceLedger;
  sessionStartedAt: string;
}

const Ctx = createContext<LedgerApi | null>(null);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const ref = useRef<EvidenceLedger | null>(null);
  if (!ref.current) ref.current = new EvidenceLedger();
  const [started] = useState(() => new Date().toISOString());
  const [entries, setEntries] = useState<readonly LedgerEntry[]>([]);
  const append = useCallback((author: LedgerAuthor, kind: LedgerKind, payload: unknown) => {
    const e = ref.current!.append(author, kind, payload);
    setEntries(ref.current!.entries());
    return e;
  }, []);
  const appendWith = useCallback((writer: (l: EvidenceLedger) => LedgerEntry) => {
    const e = writer(ref.current!);
    setEntries(ref.current!.entries());
    return e;
  }, []);
  return <Ctx.Provider value={{ entries, append, appendWith, ledger: ref.current, sessionStartedAt: started }}>{children}</Ctx.Provider>;
}

export function useLedger(): LedgerApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLedger outside LedgerProvider");
  return v;
}

export function RecordedNote({ entries }: { entries: readonly LedgerEntry[] | null }) {
  if (!entries || entries.length === 0) return null;
  return (
    <span className="small muted" role="status">
      Recorded as ledger {entries.length > 1 ? "entries" : "entry"} {entries.map((e) => `#${e.index}`).join(", ")} ·{" "}
      <span className="mono">{entries.at(-1)!.hash.slice(0, 12)}…</span> (in-memory, non-persistent)
    </span>
  );
}
