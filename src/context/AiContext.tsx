"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { preselectLeads } from "@/lib/ai/scoring";
import {
  EMPTY_PREFERENCES,
  EMPTY_PROFILE,
  HIGH_MATCH,
  LOCAL_BATCH_SIZE,
  OPENAI_BATCH_SIZE,
  profileHash,
  profileIsEmpty,
  type CompanyProfile,
  type LeadInput,
  type LeadScore,
  type RecommendResponse,
  type ScoringEngine,
  type UserPreferences,
} from "@/lib/ai/types";
import { readJson, removeKey, writeJson } from "@/lib/storage";
import type { Lead } from "@/lib/types";

const PROFILE_KEY = "goodsales:profile:v1";
const API_KEY_KEY = "goodsales:openaiKey";
const PREFS_KEY = "goodsales:userPreferences";
const SCORES_KEY = "goodsales:aiScores:v1";

interface ScoresState {
  scores: Record<string, LeadScore>;
  engine: ScoringEngine | null;
  model?: string;
  analyzedAt: string | null;
  /** Profile the scores were computed for */
  profileHash: string | null;
}

const EMPTY_SCORES: ScoresState = { scores: {}, engine: null, analyzedAt: null, profileHash: null };

interface AiContextValue {
  profile: CompanyProfile;
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
  scoreState: ScoresState;
  highMatchCount: number;
  /** Scores were computed for a different profile than the current one */
  outdated: boolean;
  running: boolean;
  warning: string | null;
  error: string | null;
  analyze: (candidates: Lead[]) => Promise<boolean>;
  clearScores: () => void;

  profileOpen: boolean;
  openProfile: (hint?: string) => void;
  closeProfile: () => void;
  profileHint: string | null;
  /** Set by "Salvesta ja analüüsi"; the leads view picks it up and runs the analysis */
  analyzeRequested: boolean;
  requestAnalyze: () => void;
  consumeAnalyzeRequest: () => void;
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

export function AiProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<CompanyProfile>(EMPTY_PROFILE);
  const [apiKey, setApiKey] = useState("");
  const [serverKey, setServerKey] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(EMPTY_PREFERENCES);
  const [prefsStored, setPrefsStored] = useState(false);
  const [scoreState, setScoreState] = useState<ScoresState>(EMPTY_SCORES);
  const [running, setRunning] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileHint, setProfileHint] = useState<string | null>(null);
  const [analyzeRequested, setAnalyzeRequested] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const p = readJson<CompanyProfile>(PROFILE_KEY);
    if (p) setProfile({ ...EMPTY_PROFILE, ...p });
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
    const s = readJson<ScoresState>(SCORES_KEY);
    if (s?.scores) setScoreState({ ...EMPTY_SCORES, ...s });
    setReady(true);

    fetch("/api/recommend", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setServerKey(Boolean(d?.serverKey)))
      .catch(() => setServerKey(false));
  }, []);

  const saveProfile = useCallback((p: CompanyProfile) => {
    setProfile(p);
    writeJson(PROFILE_KEY, p);
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

  // Favorites saved before this feature existed: learn from them once.
  const seedPreferences = useCallback(
    (leads: Lead[]) => {
      if (!ready || prefsStored || leads.length === 0) return;
      const cats: Record<string, number> = {};
      for (const l of leads) cats[l.category] = (cats[l.category] ?? 0) + 1;
      const names = [...new Set(leads.map((l) => l.buildingName.trim()).filter(Boolean))].slice(0, 30);
      updatePreferences(() => ({ likedNames: names, likedCategories: cats }));
    },
    [ready, prefsStored, updatePreferences],
  );

  const resetPreferences = useCallback(() => {
    setPreferences(EMPTY_PREFERENCES);
    writeJson(PREFS_KEY, EMPTY_PREFERENCES);
    setPrefsStored(true);
  }, []);

  const clearScores = useCallback(() => {
    setScoreState(EMPTY_SCORES);
    removeKey(SCORES_KEY);
    setWarning(null);
    setError(null);
  }, []);

  const analyze = useCallback(
    async (candidates: Lead[]) => {
      setError(null);
      setWarning(null);
      if (candidates.length === 0) {
        setError("Praeguste filtritega pole ühtegi müügivihjet, mida analüüsida.");
        return false;
      }
      const useAi = Boolean(apiKey || serverKey);
      const batch = preselectLeads(candidates.map(toInput), profile, preferences, useAi ? OPENAI_BATCH_SIZE : LOCAL_BATCH_SIZE);
      setRunning(true);
      try {
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(apiKey ? { "x-openai-key": apiKey } : {}) },
          body: JSON.stringify({ profile, preferences, leads: batch }),
        });
        const data = (await res.json().catch(() => null)) as (RecommendResponse & { error?: string }) | null;
        if (!res.ok || !data?.scores) throw new Error(data?.error || "Analüüs ebaõnnestus.");

        const hash = profileHash(profile);
        setScoreState((prev) => {
          // Same profile: add to earlier results (e.g. another filter selection). New profile: start over.
          const base = prev.profileHash === hash ? prev.scores : {};
          const next: ScoresState = {
            scores: { ...base, ...data.scores },
            engine: data.engine,
            model: data.model,
            analyzedAt: new Date().toISOString(),
            profileHash: hash,
          };
          writeJson(SCORES_KEY, next);
          return next;
        });
        if (data.warning) setWarning(data.warning);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analüüs ebaõnnestus.");
        return false;
      } finally {
        setRunning(false);
      }
    },
    [apiKey, serverKey, profile, preferences],
  );

  const openProfile = useCallback((hint?: string) => {
    setProfileHint(hint ?? null);
    setProfileOpen(true);
  }, []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);
  const requestAnalyze = useCallback(() => setAnalyzeRequested(true), []);
  const consumeAnalyzeRequest = useCallback(() => setAnalyzeRequested(false), []);

  const highMatchCount = useMemo(
    () => Object.values(scoreState.scores).filter((s) => s.score >= HIGH_MATCH).length,
    [scoreState.scores],
  );
  const outdated =
    scoreState.profileHash !== null && Object.keys(scoreState.scores).length > 0 && scoreState.profileHash !== profileHash(profile);

  const value: AiContextValue = {
    profile,
    saveProfile,
    apiKey,
    saveApiKey,
    serverKey,
    preferences,
    resetPreferences,
    recordFavorite,
    seedPreferences,
    scores: scoreState.scores,
    scoreState,
    highMatchCount,
    outdated,
    running,
    warning,
    error,
    analyze,
    clearScores,
    profileOpen,
    openProfile,
    closeProfile,
    profileHint,
    analyzeRequested,
    requestAnalyze,
    consumeAnalyzeRequest,
  };

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAi(): AiContextValue {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error("useAi must be used inside AiProvider");
  return ctx;
}

export { profileIsEmpty };
