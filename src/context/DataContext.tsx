"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { readJson, removeKey, writeJson } from "@/lib/storage";
import type { DatasetMeta, DatasetPayload, Lead } from "@/lib/types";

const CACHE_KEY = "goodsales:dataset:v1";
const POLL_MS = 60_000;

type Status = "loading" | "ready" | "error";

interface DataContextValue {
  leads: Lead[];
  meta: DatasetMeta | null;
  status: Status;
  error: string | null;
  /** Re-check the server; `force` refetches the full dataset even if the version is unchanged. */
  refresh: (force?: boolean) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const apply = useCallback((payload: DatasetPayload) => {
    versionRef.current = payload.meta.version;
    setLeads(payload.leads);
    setMeta(payload.meta);
    setStatus("ready");
    setError(null);
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (inFlight.current) return inFlight.current;
      const run = (async () => {
        try {
          if (!force && versionRef.current) {
            const res = await fetch("/api/meta", { cache: "no-store" });
            if (res.ok) {
              const m = (await res.json()) as DatasetMeta;
              if (m.version === versionRef.current) {
                setMeta(m);
                return;
              }
            }
          }
          const res = await fetch("/api/leads", { cache: "no-store" });
          if (!res.ok) throw new Error("Andmete laadimine ebaõnnestus.");
          const payload = (await res.json()) as DatasetPayload;
          apply(payload);
          if (payload.leads.length) writeJson(CACHE_KEY, payload);
          else removeKey(CACHE_KEY);
        } catch (e) {
          // Keep showing cached data if we have it.
          if (!versionRef.current) {
            setStatus("error");
            setError(e instanceof Error ? e.message : "Andmete laadimine ebaõnnestus.");
          }
        }
      })();
      inFlight.current = run;
      try {
        await run;
      } finally {
        inFlight.current = null;
      }
    },
    [apply],
  );

  useEffect(() => {
    // Show the last dataset instantly after a browser refresh, then revalidate.
    const cached = readJson<DatasetPayload>(CACHE_KEY);
    if (cached?.meta && Array.isArray(cached.leads)) apply(cached);
    void refresh();

    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [apply, refresh]);

  return <DataContext.Provider value={{ leads, meta, status, error, refresh }}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
