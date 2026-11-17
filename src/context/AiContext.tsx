"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useData } from "@/context/DataContext";
import { scoreLeadsLocal } from "@/lib/ai/scoring";
import {
  EMPTY_PREFERENCES,
  EMPTY_PROFILE,
  OPENAI_BATCH_SIZE,
  RECOMMEND_THRESHOLD,
  profileHash,
  type CompanyProfile,
  type LeadInput,
  type LeadScore,
  type RecommendResponse,
  type ScoringEngine,
  type UserPreferences,
} from "@/lib/ai/types";
import { expandToCounties } from "@/lib/regions";
import { readJson, removeKey, writeJson } from "@/lib/storage";
import type { Lead } from "@/lib/types";

const PROFILE_KEY = "goodsales:profile:v1";
const API_KEY_KEY = "goodsales:openaiKey";
const PREFS_KEY = "goodsales:userPreferences";
/** Only the OpenAI results are stored: local scores are recomputed in milliseconds on every load. */
const AI_CACHE_KEY = "goodsales:aiScores:v2";

interface AiCache {
  scores: Record<string, LeadScore>;
  model?: string;
  analyzedAt: string;
  profileHash: string;
  datasetVersion: string;
}

export interface AnalysisInfo {
  engine: ScoringEngine;
  model?: string;
  analyzedAt: string;
  /** How many leads were scored (the whole dataset) */
  total: number;
  /** How many of them OpenAI scored */
  aiCount: number;
  profileHash: string;
}

interface AiContextValue {
  profile: CompanyProfile;
  /** true when the profile has a description or building types, i.e. analysis can run */
  profileReady: boolean;
  saveProfile: (p: CompanyProfile) => void;
  apiKey: string;
  saveApiKey: (key: string) => void;
  serverKey: boolean;
  preferences: UserPreferences;
  resetPreferences: () => void;
  /** Called by favorites: learn from what the user stars */
  recordFavorite: (lead: Lead, added: boolean) => void;
  seedPreferences: (leads: Lead[]) => void;

  scores: Record<string, LeadScore>;
  info: AnalysisInfo | null;
  /** Leads at or above RECOMMEND_THRESHOLD */
  recommendedCount: number;
  running: boolean;
  warning: string | null;
  error: string | null;
  /** Re-run now; refreshes OpenAI results instead of using the cache */
  reanalyze: () => void;

  profileOpen: boolean;
  openProfile: (hint?: string) => void;
  closeProfile: () => void;
  profileHint: string | null;
}

const AiContext = createContext<AiContextValue | null>(null);

function toInput(l: Lead): LeadInput {
  return {
    id: l.id,
    date: l.date,
    docType: l.docType,
    buildingName: l.buildingName,
    category: l.category,
    address: l.address,
    county: l.county,
    region: l.region,
    status: l.status,
  };
}

/** Older profiles stored regions without their counties: counties are now the source of truth. */
function normalizeProfile(p: CompanyProfile): CompanyProfile {
  return { ...p, counties: expandToCounties(p.regions, p.counties) };
}

export function AiProvider({ children }: { children: ReactNode }) {
  const { leads, meta, status: dataStatus } = useData();

  const [profile, setProfile] = useState<CompanyProfile>(EMPTY_PROFILE);
  const [apiKey, setApiKey] = useState("");
  const [serverKey, setServerKey] = useState(false);
  const [serverKeyChecked, setServerKeyChecked] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(EMPTY_PREFERENCES);
  const [prefsStored, setPrefsStored] = useState(false);
  const [scores, setScores] = useState<Record<string, LeadScore>>({});
  const [info, setInfo] = useState<AnalysisInfo | null>(null);
  const [running, setRunning] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileHint, setProfileHint] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [runNonce, setRunNonce] = useState(0);

  const leadsRef = useRef(leads);
  leadsRef.current = leads;
  const prefsRef = useRef(preferences);
  prefsRef.current = preferences;
  const forceRef = useRef(false);
  const runId = useRef(0);

  useEffect(() => {
    const p = readJson<CompanyProfile>(PROFILE_KEY);
    if (p) setProfile(normalizeProfile({ ...EMPTY_PROFILE, ...p }));
    try {
      setApiKey(window.localStorage.getItem(API_KEY_KEY) ?? "");
    } catch {
      /* storage unavailable */
    }
    const prefs = readJson<UserPreferences>(PREFS_KEY);
    if (prefs) {
      setPreferences({ ...EMPTY_PREFERENCES, ...prefs });
      setPrefsStored(true);
    }
    removeKey("goodsales:aiScores:v1"); // format of the previous version
    setReady(true);

    fetch("/api/recommend", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setServerKey(Boolean(d?.serverKey)))
      .catch(() => setServerKey(false))
      .finally(() => setServerKeyChecked(true));
  }, []);

  const profileReady = profile.description.trim().length > 0 || profile.categories.length > 0;
  const hash = profileHash(profile);
  const datasetVersion = meta?.version ?? "";

  /* ---------- Automatic analysis ---------- */
  // Runs on load (stored profile), when the dataset version changes, when the profile or key changes,
  // and when reanalyze() is called (e.g. "Salvesta" in the profile panel).
  useEffect(() => {
    if (!ready || !serverKeyChecked || dataStatus === "loading") return;
    const all = leadsRef.current;
    const force = forceRef.current;
    forceRef.current = false;
    const id = ++runId.current;

    if (!profileReady || all.length === 0) {
      setScores({});
      setInfo(null);
      setWarning(null);
      setError(null);
      setRunning(false);
      return;
    }

    setRunning(true);
    setWarning(null);
    setError(null);

    // Let the spinner render before the (fast, synchronous) scoring of the whole dataset.
    const timer = window.setTimeout(async () => {
      const inputs = all.map(toInput);
      const local = scoreLeadsLocal(inputs, profile, prefsRef.current);
      if (id !== runId.current) return;

      const now = new Date().toISOString();
      const useAi = Boolean(apiKey || serverKey);
      if (!useAi) {
        setScores(local);
        setInfo({ engine: "local", analyzedAt: now, total: inputs.length, aiCount: 0, profileHash: hash });
        setRunning(false);
        return;
      }

      // Cached OpenAI results for this exact profile and dataset: no new API call on page load.
      const cache = readJson<AiCache>(AI_CACHE_KEY);
      if (!force && cache && cache.profileHash === hash && cache.datasetVersion === datasetVersion) {
        setScores({ ...local, ...cache.scores });
        setInfo({
          engine: "openai",
          model: cache.model,
          analyzedAt: cache.analyzedAt,
          total: inputs.length,
          aiCount: Object.keys(cache.scores).length,
          profileHash: hash,
        });
        setRunning(false);
        return;
      }

      // Show the local result right away, then refine the best candidates with OpenAI.
      setScores(local);
      const top = [...inputs]
        .sort((a, b) => local[b.id].score - local[a.id].score || (a.date < b.date ? 1 : -1))
        .slice(0, OPENAI_BATCH_SIZE);
      try {
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(apiKey ? { "x-openai-key": apiKey } : {}) },
          body: JSON.stringify({ profile, preferences: prefsRef.current, leads: top }),
        });
        const data = (await res.json().catch(() => null)) as (RecommendResponse & { error?: string }) | null;
        if (id !== runId.current) return;
        if (!res.ok || !data?.scores) throw new Error(data?.error || "AI analüüs ebaõnnestus.");

        const aiScores: Record<string, LeadScore> = {};
        for (const [leadId, s] of Object.entries(data.scores)) if (s.source === "openai") aiScores[leadId] = s;
        const aiCount = Object.keys(aiScores).length;
        setScores({ ...local, ...aiScores });
        setInfo({ engine: aiCount ? "openai" : "local", model: data.model, analyzedAt: now, total: inputs.length, aiCount, profileHash: hash });
        if (data.warning) setWarning(data.warning);
        if (aiCount) writeJson(AI_CACHE_KEY, { scores: aiScores, model: data.model, analyzedAt: now, profileHash: hash, datasetVersion } satisfies AiCache);
      } catch (e) {
        if (id !== runId.current) return;
        setInfo({ engine: "local", analyzedAt: now, total: inputs.length, aiCount: 0, profileHash: hash });
        setWarning(`${e instanceof Error ? e.message : "AI analüüs ebaõnnestus."} Kasutati lokaalset sobivusalgoritmi.`);
      } finally {
        if (id === runId.current) setRunning(false);
      }
    }, 30);

    return () => window.clearTimeout(timer);
    // Preferences are deliberately not a trigger: starring a lead must not reshuffle the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, serverKeyChecked, dataStatus, datasetVersion, hash, profileReady, apiKey, serverKey, runNonce]);

  const reanalyze = useCallback(() => {
    forceRef.current = true;
    setRunNonce((n) => n + 1);
  }, []);

  /* ---------- Profile, key, preferences ---------- */

  const saveProfile = useCallback((p: CompanyProfile) => {
    const next = normalizeProfile(p);
    setProfile(next);
    writeJson(PROFILE_KEY, next);
  }, []);

  const saveApiKey = useCallback((key: string) => {
    const k = key.trim();
    setApiKey(k);
    try {
      if (k) window.localStorage.setItem(API_KEY_KEY, k);
      else window.localStorage.removeItem(API_KEY_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const updatePreferences = useCallback((fn: (p: UserPreferences) => UserPreferences) => {
    setPreferences((prev) => {
      const next = fn(prev);
      writeJson(PREFS_KEY, next);
      return next;
    });
    setPrefsStored(true);
  }, []);

  const recordFavorite = useCallback(
    (lead: Lead, added: boolean) => {
      const name = lead.buildingName.trim();
      updatePreferences((p) => {
        const cats = { ...p.likedCategories };
        if (added) {
          cats[lead.category] = (cats[lead.category] ?? 0) + 1;
          const names = name ? [name, ...p.likedNames.filter((n) => n.toLowerCase() !== name.toLowerCase())].slice(0, 30) : p.likedNames;
          return { likedNames: names, likedCategories: cats };
        }
        const left = (cats[lead.category] ?? 0) - 1;
        if (left > 0) cats[lead.category] = left;
        else delete cats[lead.category];
        return { likedNames: p.likedNames.filter((n) => n.toLowerCase() !== name.toLowerCase()), likedCategories: cats };
      });
    },
    [updatePreferences],
  );

  // Favorites saved before the AI feature existed: learn from them once.
  const seedPreferences = useCallback(
    (favs: Lead[]) => {
      if (!ready || prefsStored || favs.length === 0) return;
      const cats: Record<string, number> = {};
      for (const l of favs) cats[l.category] = (cats[l.category] ?? 0) + 1;
      const names = [...new Set(favs.map((l) => l.buildingName.trim()).filter(Boolean))].slice(0, 30);
      updatePreferences(() => ({ likedNames: names, likedCategories: cats }));
    },
    [ready, prefsStored, updatePreferences],
  );

  const resetPreferences = useCallback(() => {
    setPreferences(EMPTY_PREFERENCES);
    writeJson(PREFS_KEY, EMPTY_PREFERENCES);
    setPrefsStored(true);
  }, []);

  const openProfile = useCallback((hint?: string) => {
    setProfileHint(hint ?? null);
    setProfileOpen(true);
  }, []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);

  const recommendedCount = useMemo(
    () => Object.values(scores).filter((s) => s.score >= RECOMMEND_THRESHOLD).length,
    [scores],
  );

  const value: AiContextValue = {
    profile,
    profileReady,
    saveProfile,
    apiKey,
    saveApiKey,
    serverKey,
    preferences,
    resetPreferences,
    recordFavorite,
    seedPreferences,
    scores,
    info,
    recommendedCount,
    running,
    warning,
    error,
    reanalyze,
    profileOpen,
    openProfile,
    closeProfile,
    profileHint,
  };

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAi(): AiContextValue {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error("useAi must be used inside AiProvider");
  return ctx;
}
