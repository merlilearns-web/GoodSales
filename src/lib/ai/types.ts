import type { Lead } from "../types";

/** The user's sales profile, stored in localStorage. */
export interface CompanyProfile {
  /** Free text: what the company sells / does */
  description: string;
  /** Preferred regions (Regioon); empty = all */
  regions: string[];
  /** Preferred counties (Maakond); empty = all */
  counties: string[];
  /** Preferred building categories (see lib/categories.ts); empty = infer from description */
  categories: string[];
}

export const EMPTY_PROFILE: CompanyProfile = { description: "", regions: [], counties: [], categories: [] };

/** Learned from the user's favorites (implicit feedback). */
export interface UserPreferences {
  /** Building names of leads the user has starred, newest first */
  likedNames: string[];
  /** How many starred leads fall into each category */
  likedCategories: Record<string, number>;
}

export const EMPTY_PREFERENCES: UserPreferences = { likedNames: [], likedCategories: {} };

export interface LeadScore {
  /** 1–100 match with the company profile */
  score: number;
  /** One Estonian sentence: why this lead is relevant */
  reason: string;
  /** Short Estonian action tag */
  suggestedAction: string;
  /** Which engine produced this score */
  source?: ScoringEngine;
}

export type ScoringEngine = "openai" | "local";

/** The subset of lead fields sent to /api/recommend */
export type LeadInput = Pick<Lead, "id" | "date" | "docType" | "buildingName" | "category" | "address" | "county" | "region" | "status">;

export interface RecommendRequest {
  profile: CompanyProfile;
  preferences?: UserPreferences;
  leads: LeadInput[];
}

export interface RecommendResponse {
  engine: ScoringEngine;
  model?: string;
  scores: Record<string, LeadScore>;
  /** Shown to the user when OpenAI failed and the local algorithm was used instead */
  warning?: string;
}

export const OPENAI_BATCH_SIZE = 30;
/** Max leads the server scores locally per request (the browser scores the whole dataset itself) */
export const LOCAL_BATCH_SIZE = 300;
/** Leads at or above this score are shown in "AI soovitused" and counted in its badge */
export const RECOMMEND_THRESHOLD = 60;

export function profileIsEmpty(p: CompanyProfile): boolean {
  return !p.description.trim() && p.categories.length === 0 && p.regions.length === 0 && p.counties.length === 0;
}

/** Stable fingerprint: scores computed for an older profile are flagged as outdated. */
export function profileHash(p: CompanyProfile): string {
  return JSON.stringify([p.description.trim(), [...p.regions].sort(), [...p.counties].sort(), [...p.categories].sort()]);
}
