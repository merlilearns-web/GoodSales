/**
 * Local "smart" lead scoring: deterministic, no network, works out of the box.
 * Used when no OpenAI key is available, as a fallback when OpenAI fails, and to
 * pre-select the best candidates before sending a small batch to OpenAI.
 *
 * Fit (0–60) =
 *   type fit 0–30   building category vs. preferred types / types inferred from the description
 *   text fit 0–10   Estonian word-stem overlap between the description and the building name
 *   recency  0–8    days since "Dokumendi kuupäev"
 *   status   0–6    early-stage applications are the best time to reach out
 *   learned  0–6    similarity to leads the user has starred
 * Location (target area = chosen counties/regions + places named in the description):
 *   inside the area +45, outside −50 from a neutral +30 and capped at 45 %, no area set: +30.
 * Caps: wrong building type ≤ 55 %, refused application ≤ 35 %. Final score clamped to 1–100.
 */
import { COUNTY_REGION, detectLocations, expandToCounties, shortCounty } from "../regions";
import type { CompanyProfile, LeadInput, LeadScore, UserPreferences } from "./types";

const C = {
  house: "Üksikelamu",
  row: "Ridaelamu / paariselamu",
  apartment: "Korterelamu",
  summer: "Aiamaja / suvila",
  sauna: "Saun",
  aux: "Abihoone / garaaž",
  hall: "Viilhall / tootmishoone",
  warehouse: "Ladu",
  business: "Ärihoone",
  farm: "Põllumajandushoone",
  infra: "Rajatis",
  public: "Ühiskondlik hoone",
} as const;

const ALL_BUILDINGS = [C.house, C.row, C.apartment, C.summer, C.sauna, C.aux, C.hall, C.warehouse, C.business, C.farm, C.public];
const HEATED = [C.house, C.row, C.apartment, C.summer, C.business, C.public, C.hall];

interface Group {
  /** "object": names a building type the company targets; "trade": a product/service that fits several types */
  kind: "object" | "trade";
  /** Estonian label used in explanations */
  label: string;
  /** Folded word stems. Stems starting with "*" match anywhere inside a word (compounds), others match word starts. */
  stems: string[];
  /** Building categories this business line / object type targets */
  targets: string[];
}

/** Estonian synonym groups (diacritics folded: õ→o, ä→a, ö→o, ü→u). */
const GROUPS: Group[] = [
  { kind: "object", label: "eramud", stems: ["eramu", "eramaja", "*uksikelamu", "elumaja", "maja", "majad", "kodu", "peremaja", "*puitmaja", "*palkmaja", "*moodulmaja"], targets: [C.house] },
  { kind: "object", label: "rida- ja paariselamud", stems: ["*ridaelamu", "*ridamaja", "*paarismaja", "*paariselamu", "*kaksikelamu", "*kaksikmaja"], targets: [C.row] },
  { kind: "object", label: "korterelamud", stems: ["*korter"], targets: [C.apartment] },
  { kind: "object", label: "elamud", stems: ["elamu", "eluhoone", "eluase", "elamuehitus"], targets: [C.house, C.row, C.apartment] },
  {
    kind: "trade",
    label: "küte ja ventilatsioon",
    stems: ["*kute", "*kutte", "*soojuspump", "*maasoojus", "katel", "katla", "*katlamaja", "radiaator", "*ventilatsioon", "vent", "jahutus", "konditsioneer", "kliima", "*soojustagastus", "*ohksoojus"],
    targets: HEATED,
  },
  {
    kind: "trade",
    label: "ehitus- ja viimistlustööd",
    stems: [
      "katus", "*fassaad", "aken", "akna", "akende", "uks", "uksed", "vundament", "soojustus", "betoon", "karkass", "ehitus", "ehitame",
      "*uldehitus", "projekteer", "arhitekt", "sisustus", "sisekujundus", "kook", "plaatimine", "viimistl", "torutoo", "*sanitaartehnika",
      "*kanalisatsioon", "veevarustus", "elektritoo", "trepp", "terrass", "puit", "kips", "krohv", "renoveer",
    ],
    targets: ALL_BUILDINGS,
  },
  {
    kind: "trade",
    label: "elekter ja energia",
    stems: ["*paikese", "paike", "elektri", "elekter", "liitum", "*kaabel", "alajaam", "*akusalvest", "salvesti", "laadija", "laadimis", "energia"],
    targets: [C.infra, C.hall, C.warehouse, C.business, C.farm],
  },
  {
    kind: "object",
    label: "tootmis- ja laohooned",
    stems: ["ladu", "ladude", "*laohoone", "logistika", "tootmine", "*tootmis", "toostus", "*hall", "angaar", "*teraskonstrukts", "terashall"],
    targets: [C.warehouse, C.hall, C.farm],
  },
  { kind: "object", label: "ärihooned", stems: ["ari", "*arihoone", "buroo", "kontor", "kaubandus", "kauplus", "pood", "hotell", "majutus", "toitlust", "restoran"], targets: [C.business] },
  { kind: "object", label: "aiamajad ja suvilad", stems: ["*aiamaja", "suvila", "puhkemaja", "suvemaja"], targets: [C.summer] },
  { kind: "object", label: "saunad", stems: ["*saun"], targets: [C.sauna] },
  { kind: "object", label: "abihooned ja garaažid", stems: ["*abihoone", "garaa", "kuur", "varjualune", "kuuri"], targets: [C.aux] },
  { kind: "object", label: "põllumajandushooned", stems: ["laut", "farm", "pollumajandus", "kasvuhoone", "kuun", "loomapidamis"], targets: [C.farm] },
  { kind: "object", label: "taristu ja rajatised", stems: ["teede", "teeehitus", "asfalt", "sild", "tanav", "parkla", "piirdeaed", "rajatis", "kommunikatsioon"], targets: [C.infra] },
  { kind: "object", label: "avalikud hooned", stems: ["kool", "lasteaed", "spordi", "haigla", "hooldekodu", "rahvamaja"], targets: [C.public] },
];

/** Words that carry no meaning for matching */
const STOP = new Set([
  "muume", "muuja", "paigal", "pakume", "teeme", "teenu", "lahen", "klien", "ettev", "firma", "toote", "uutel", "uute", "uued", "olema",
  "samut", "eelko", "peami", "kogu", "eesti", "ning", "jaoks", "korra", "tegel", "sobiv", "vaike", "suure", "parim", "kvali", "hinna",
]);

export function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function words(s: string): string[] {
  return fold(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
}

function stemOf(w: string): string {
  return w.slice(0, 5);
}

function groupMatches(group: Group, ws: string[]): boolean {
  return group.stems.some((stem) =>
    stem.startsWith("*") ? ws.some((w) => w.includes(stem.slice(1))) : ws.some((w) => w.startsWith(stem)),
  );
}

function meaningfulStems(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of words(text)) {
    if (w.length < 4) continue;
    const s = stemOf(w);
    if (!STOP.has(s)) out.add(s);
  }
  return out;
}

const STATUS_POINTS: Record<string, number> = {
  esitatud: 6,
  menetluses: 6,
  taiendamisel: 5,
  "lubatud/teavitatud": 4,
  "registrisse kantud": 2,
  keeldutud: 0,
};

/** Location weighting when the user has target areas */
const LOCATION_BOOST = 45;
const LOCATION_PENALTY = 50;
const OUTSIDE_AREA_MAX = 45;
/** A lead of a building type the profile does not target can never become a recommendation */
const WRONG_TYPE_MAX = 55;

const STATUS_PHRASE: Record<string, string> = {
  esitatud: "taotlus on äsja esitatud",
  menetluses: "taotlus on menetluses",
  taiendamisel: "taotlus on täiendamisel",
  "lubatud/teavitatud": "projekteerimistingimused on väljastatud",
  "registrisse kantud": "dokument on registrisse kantud",
  keeldutud: "taotlusest on keeldutud",
};

const EARLY = new Set(["esitatud", "menetluses", "taiendamisel"]);

export interface ScoringContext {
  profile: CompanyProfile;
  /** Categories inferred from the description -> label of the matching group; primary = named as a building type */
  inferred: Map<string, { label: string; primary: boolean }>;
  descGroups: Group[];
  descStems: Set<string>;
  likedStems: Set<string>;
  likedCategories: Record<string, number>;
  /** Target counties: chosen in the profile, expanded from chosen regions, or named in the description */
  counties: Set<string>;
  /** Target areas mentioned only in the description (for the explanation) */
  textAreas: string[];
  now: number;
}

export function buildScoringContext(profile: CompanyProfile, prefs?: UserPreferences, now = Date.now()): ScoringContext {
  const descWords = words(profile.description);
  const descGroups = GROUPS.filter((g) => groupMatches(g, descWords));
  const inferred = new Map<string, { label: string; primary: boolean }>();
  // Building types named in the description are primary targets; types that only fit the product
  // (e.g. heating fits every heated building) are secondary — unless no building type is named at all.
  const namesObjects = descGroups.some((g) => g.kind === "object");
  // Object groups first, then more specific groups (fewer targets) win the label.
  const ordered = [...descGroups].sort(
    (a, b) => (a.kind === b.kind ? 0 : a.kind === "object" ? -1 : 1) || a.targets.length - b.targets.length,
  );
  for (const g of ordered) {
    const primary = g.kind === "object" || !namesObjects;
    for (const t of g.targets) if (!inferred.has(t)) inferred.set(t, { label: g.label, primary });
  }
  const likedStems = new Set<string>();
  for (const name of prefs?.likedNames ?? []) for (const s of meaningfulStems(name)) likedStems.add(s);

  // Target area = selected counties + counties of selected regions + places named in the description.
  const fromText = detectLocations(profile.description);
  const counties = new Set(expandToCounties(profile.regions, [...profile.counties, ...fromText.counties]));

  return {
    profile,
    inferred,
    descGroups,
    descStems: meaningfulStems(profile.description),
    likedStems,
    likedCategories: prefs?.likedCategories ?? {},
    counties,
    textAreas: [...fromText.regions, ...fromText.counties.filter((c) => !fromText.regions.some((r) => COUNTY_REGION[c] === r)).map(shortCounty)],
    now,
  };
}

function daysSince(iso: string, now: number): number | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

export function scoreLeadLocal(lead: LeadInput, ctx: ScoringContext): LeadScore {
  const { profile } = ctx;
  const status = fold(lead.status.trim());

  // 1. Type fit (0–30)
  let typePts: number;
  let fitClause: string;
  let wrongType = false;
  const inferred = ctx.inferred.get(lead.category);
  if (profile.categories.length) {
    if (profile.categories.includes(lead.category)) {
      typePts = 30;
      fitClause = "vastab teie eelistatud objektitüübile";
    } else if (inferred) {
      typePts = inferred.primary ? 20 : 12;
      // Only implied by the product/trade while the user picked specific types: shown, never recommended.
      wrongType = !inferred.primary;
      fitClause = `sobib teie tegevusalaga (${inferred.label})`;
    } else {
      typePts = 0;
      wrongType = true;
      fitClause = "objektitüüp ei kuulu teie eelistuste hulka";
    }
  } else if (ctx.inferred.size) {
    typePts = inferred ? (inferred.primary ? 28 : 16) : 0;
    // Secondary = type only implied by the trade (e.g. "ehitame") although the description names specific types.
    wrongType = !inferred || !inferred.primary;
    fitClause = inferred
      ? inferred.primary
        ? `sobib teie sihtrühmaga (${inferred.label})`
        : `võib vajada teie lahendusi (${inferred.label})`
      : "objektitüüp ei ole teie tegevusalaga otseselt seotud";
  } else {
    typePts = 15;
    fitClause = "";
  }

  // 2. Text fit (0–10): shared word stems + business lines mentioned in the building name
  const nameWords = words(lead.buildingName);
  let overlap = 0;
  for (const s of meaningfulStems(lead.buildingName)) if (ctx.descStems.has(s)) overlap++;
  const nameGroupHit = ctx.descGroups.some((g) => g.targets.length < ALL_BUILDINGS.length && groupMatches(g, nameWords));
  const textPts = Math.min(10, (overlap >= 2 ? 10 : overlap === 1 ? 6 : 0) + (nameGroupHit ? 5 : 0));

  // 3. Recency (0–8)
  const days = daysSince(lead.date, ctx.now);
  const recencyPts = days === null ? 2 : days <= 14 ? 8 : days <= 30 ? 7 : days <= 60 ? 5 : days <= 90 ? 4 : days <= 180 ? 2 : 1;

  // 4. Status (0–6)
  const statusPts = STATUS_POINTS[status] ?? 3;

  // 5. Learned from favorites (0–6)
  const likedCat = ctx.likedCategories[lead.category] ?? 0;
  let likedOverlap = 0;
  for (const s of meaningfulStems(lead.buildingName)) if (ctx.likedStems.has(s)) likedOverlap++;
  const learnedPts = Math.min(6, Math.min(4, likedCat * 2) + (likedOverlap ? 2 : 0));

  // 6. Location: decisive in construction sales.
  //    Target area set: inside +45, outside −50 and never above 45 %. No target area: neutral +30.
  const fit = typePts + textPts + recencyPts + statusPts + learnedPts; // 0–60
  let score: number;
  let locClause = "";
  const inArea = ctx.counties.has(lead.county);
  if (ctx.counties.size === 0) {
    score = fit + 30;
  } else if (inArea) {
    score = fit + LOCATION_BOOST;
    locClause = ctx.textAreas.length && !profile.counties.includes(lead.county) && !profile.regions.includes(lead.region)
      ? `asub teie kirjelduses nimetatud piirkonnas (${ctx.textAreas.join(", ")})`
      : "asub teie sihtpiirkonnas";
  } else {
    score = Math.min(OUTSIDE_AREA_MAX, fit + 30 - LOCATION_PENALTY);
    locClause = "asub väljaspool teie sihtpiirkondi";
  }
  if (wrongType) score = Math.min(score, WRONG_TYPE_MAX);
  if (status === "keeldutud") score = Math.min(score, 35);
  score = Math.max(1, Math.min(100, Math.round(score)));

  // Explanation: one Estonian sentence built from the strongest factors.
  const subject = lead.category && lead.category !== "Muu" ? lead.category : lead.buildingName || "Objekt";
  const statusPhrase = STATUS_PHRASE[status] ?? (lead.status ? `seisund: ${lowerFirst(lead.status)}` : "seisund teadmata");
  const when = days !== null && days <= 45 ? ` (${days === 0 ? "täna" : `${days} päeva tagasi`})` : "";
  const clauses = [fitClause, locClause].filter(Boolean);
  if (learnedPts >= 6) clauses.push("sarnaneb teie lemmikuks märgitud objektidega");
  const advice =
    status === "keeldutud"
      ? " – projekt ei pruugi edasi minna"
      : EARLY.has(status)
        ? " – hea aeg pakkumiseks enne põhiprojekti valmimist"
        : status === "lubatud/teavitatud"
          ? " – projekteerimine algab peagi"
          : "";
  const joined = clauses.length > 1 ? `${clauses.slice(0, -1).join(", ")} ja ${clauses[clauses.length - 1]}` : clauses[0] ?? "";
  const reason = `${subject} (${lead.county || lead.region || "asukoht teadmata"}): ${statusPhrase}${when}${
    joined ? `; ${joined}` : ""
  }${advice}.`;

  let suggestedAction: string;
  if (status === "keeldutud" || score < 45) suggestedAction = "Madal prioriteet";
  else if (score >= 75 && EARLY.has(status)) suggestedAction = "Võta kohe ühendust";
  else if (score >= 75) suggestedAction = "Paku terviklahendust";
  else if (EARLY.has(status)) suggestedAction = "Võta ühendust projekteerijaga";
  else suggestedAction = "Jälgi projekti arengut";

  return { score, reason, suggestedAction, source: "local" };
}

export function scoreLeadsLocal(leads: LeadInput[], profile: CompanyProfile, prefs?: UserPreferences, now?: number): Record<string, LeadScore> {
  const ctx = buildScoringContext(profile, prefs, now);
  const out: Record<string, LeadScore> = {};
  for (const l of leads) out[l.id] = scoreLeadLocal(l, ctx);
  return out;
}

/** Picks the `n` most promising leads by local score (used to keep OpenAI batches small). */
export function preselectLeads<T extends LeadInput>(leads: T[], profile: CompanyProfile, prefs: UserPreferences | undefined, n: number): T[] {
  const ctx = buildScoringContext(profile, prefs);
  return leads
    .map((l) => ({ l, s: scoreLeadLocal(l, ctx).score }))
    .sort((a, b) => b.s - a.s || (a.l.date < b.l.date ? 1 : -1))
    .slice(0, n)
    .map((x) => x.l);
}
