"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAi } from "@/context/AiContext";
import { readJson, writeJson } from "@/lib/storage";
import type { Lead } from "@/lib/types";

const KEY = "goodsales:favorites:v1";

interface FavoritesContextValue {
  /** Saved leads, keyed by id. A snapshot is kept so bookmarks survive a dataset replacement. */
  favorites: Record<string, Lead>;
  count: number;
  isFavorite: (id: string) => boolean;
  toggle: (lead: Lead) => void;
  clearAll: () => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Record<string, Lead>>({});
  const [loaded, setLoaded] = useState(false);
  const { recordFavorite, seedPreferences } = useAi();
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;

  useEffect(() => {
    const stored = readJson<Record<string, Lead>>(KEY);
    if (stored && typeof stored === "object") setFavorites(stored);
    setLoaded(true);

    // Keep tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setFavorites(readJson<Record<string, Lead>>(KEY) ?? {});
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (loaded) writeJson(KEY, favorites);
  }, [favorites, loaded]);

  // Implicit learning: favorites saved before the AI feature existed seed the preferences once.
  useEffect(() => {
    if (loaded) seedPreferences(Object.values(favoritesRef.current));
  }, [loaded, seedPreferences]);

  const toggle = useCallback(
    (lead: Lead) => {
      const adding = !favoritesRef.current[lead.id];
      setFavorites((prev) => {
        const next = { ...prev };
        if (adding) next[lead.id] = lead;
        else delete next[lead.id];
        return next;
      });
      recordFavorite(lead, adding);
    },
    [recordFavorite],
  );

  const clearAll = useCallback(() => setFavorites({}), []);
  const isFavorite = useCallback((id: string) => Boolean(favorites[id]), [favorites]);

  const value = useMemo(
    () => ({ favorites, count: Object.keys(favorites).length, isFavorite, toggle, clearAll }),
    [favorites, isFavorite, toggle, clearAll],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used inside FavoritesProvider");
  return ctx;
}
