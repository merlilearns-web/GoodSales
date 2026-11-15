import { NextResponse } from "next/server";
import { DEFAULT_MODEL, OpenAIError, scoreWithOpenAI } from "@/lib/ai/openai";
import { scoreLeadsLocal } from "@/lib/ai/scoring";
import {
  LOCAL_BATCH_SIZE,
  OPENAI_BATCH_SIZE,
  type CompanyProfile,
  type LeadInput,
  type RecommendResponse,
  type UserPreferences,
} from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

/* ---------- Input sanitising ---------- */

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const strList = (v: unknown, maxItems: number, maxLen: number) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, maxItems).map((x) => x.slice(0, maxLen)) : [];

function parseProfile(v: unknown): CompanyProfile {
  const p = (v ?? {}) as Record<string, unknown>;
  return {
    description: str(p.description, 2000),
    regions: strList(p.regions, 20, 60),
    counties: strList(p.counties, 30, 60),
    categories: strList(p.categories, 30, 60),
  };
}

function parsePreferences(v: unknown): UserPreferences {
  const p = (v ?? {}) as Record<string, unknown>;
  const cats: Record<string, number> = {};
  if (p.likedCategories && typeof p.likedCategories === "object") {
    for (const [k, n] of Object.entries(p.likedCategories as Record<string, unknown>).slice(0, 30)) {
      if (typeof n === "number" && n > 0) cats[k.slice(0, 60)] = Math.min(n, 100);
    }
  }
  return { likedNames: strList(p.likedNames, 30, 120), likedCategories: cats };
}

function parseLeads(v: unknown): LeadInput[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, LOCAL_BATCH_SIZE).map((x) => {
    const l = (x ?? {}) as Record<string, unknown>;
    return {
      id: str(l.id, 80),
      date: str(l.date, 10),
      docType: str(l.docType, 120),
      buildingName: str(l.buildingName, 300),
      category: str(l.category, 60),
      address: str(l.address, 400),
      county: str(l.county, 60),
      region: str(l.region, 60),
      status: str(l.status, 60),
    };
  }).filter((l) => l.id);
}

/* ---------- Rate limit for the server's own OpenAI key ---------- */

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 20;
declare global {
  // eslint-disable-next-line no-var
  var __goodsalesAiHits: Map<string, number[]> | undefined;
}

function allowServerKeyUse(ip: string): boolean {
  const hits = (globalThis.__goodsalesAiHits ??= new Map<string, number[]>());
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}

/* ---------- Handlers ---------- */

/** GET: tells the client whether the server has its own OpenAI key configured. */
export async function GET() {
  return NextResponse.json(
    { serverKey: Boolean(process.env.OPENAI_API_KEY), model: DEFAULT_MODEL },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Vigane päring." }, { status: 400 });
  }

  const profile = parseProfile(body.profile);
  const preferences = parsePreferences(body.preferences);
  const leads = parseLeads(body.leads);
  if (leads.length === 0) return NextResponse.json({ error: "Analüüsimiseks pole ühtegi müügivihjet." }, { status: 400 });

  const userKey = (req.headers.get("x-openai-key") ?? "").trim().slice(0, 300);
  const serverKey = process.env.OPENAI_API_KEY ?? "";
  const apiKey = userKey || serverKey;

  // Local scores for everything: used directly, or to fill any gaps OpenAI leaves.
  const local = scoreLeadsLocal(leads, profile, preferences);

  if (!apiKey) {
    return NextResponse.json({ engine: "local", scores: local } satisfies RecommendResponse);
  }

  if (!userKey) {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    if (!allowServerKeyUse(ip)) {
      return NextResponse.json({
        engine: "local",
        scores: local,
        warning: "Serveri AI-päringute limiit on hetkel täis. Kasutati lokaalset sobivusalgoritmi; proovi mõne minuti pärast uuesti.",
      } satisfies RecommendResponse);
    }
  }

  const batch = leads.slice(0, OPENAI_BATCH_SIZE);
  try {
    const ai = await scoreWithOpenAI(apiKey, profile, preferences, batch);
    if (Object.keys(ai).length === 0) throw new OpenAIError("OpenAI ei tagastanud ühtegi hinnangut.");
    // Leads beyond the OpenAI batch, or skipped by the model, keep their local score.
    return NextResponse.json({
      engine: "openai",
      model: DEFAULT_MODEL,
      scores: { ...local, ...ai },
    } satisfies RecommendResponse);
  } catch (err) {
    const message = err instanceof OpenAIError ? err.message : "OpenAI analüüs ebaõnnestus.";
    if (!(err instanceof OpenAIError)) console.error("POST /api/recommend", err);
    return NextResponse.json({
      engine: "local",
      scores: local,
      warning: `${message} Kasutati lokaalset sobivusalgoritmi.`,
    } satisfies RecommendResponse);
  }
}
