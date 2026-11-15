import "server-only";
import type { CompanyProfile, LeadInput, LeadScore, UserPreferences } from "./types";

export const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const TIMEOUT_MS = 60_000;

export class OpenAIError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

const SYSTEM_PROMPT = `Sa oled kogenud Eesti ehitus- ja arhitektuurisektori B2B müügianalüütik.
Sulle antakse müüja ettevõtte profiil ja nimekiri Ehitisregistri projekteerimistingimuste taotlustest (varajased müügivihjed: ehitis on alles planeerimisfaasis, enne põhiprojekti ja ehitusluba).
Hinda iga vihje sobivust ettevõtte profiiliga.

Reeglid:
- score: täisarv 1–100 (kui hästi vihje sobib ettevõtte tegevusala, eelistatud objektitüüpide ja piirkondadega).
- Arvesta: objektitüüp ja ehitise nimetus vs ettevõtte tooted/teenused; asukoht vs eelistatud piirkonnad; seisund (Esitatud/Menetluses/Täiendamisel = parim aeg pakkumiseks; Lubatud/Teavitatud = projekteerimine algab peagi; Keeldutud = madal prioriteet, score kuni 30); värskus (uuemad paremad).
- Kui kasutaja on varem lemmikuks märkinud sarnaseid objekte, tõsta sarnaste vihjete hinnet veidi.
- reason: TÄPSELT üks lühike, konkreetne ja tegevusele suunatud lause loomulikus eesti keeles (kuni 200 tähemärki), mis selgitab, MIKS see vihje on (või ei ole) ettevõttele oluline. Ära korda lihtsalt andmeid.
- suggestedAction: 2–4 sõnaline soovitus eesti keeles, nt "Võta kohe ühendust", "Paku terviklahendust", "Võta ühendust projekteerijaga", "Jälgi projekti arengut", "Madal prioriteet".
- Tagasta iga sisendvihje kohta täpselt üks tulemus sama id-ga.`;

const RESPONSE_SCHEMA = {
  name: "lead_scores",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "score", "reason", "suggestedAction"],
          properties: {
            id: { type: "string" },
            score: { type: "integer" },
            reason: { type: "string" },
            suggestedAction: { type: "string" },
          },
        },
      },
    },
  },
};

function buildUserMessage(profile: CompanyProfile, prefs: UserPreferences | undefined, leads: LeadInput[]): string {
  const liked = (prefs?.likedNames ?? []).slice(0, 15);
  return JSON.stringify({
    ettevotte_profiil: {
      tegevusala: profile.description || "(kirjeldamata)",
      eelistatud_maakonnad: profile.counties.length ? profile.counties : "kõik",
      eelistatud_regioonid: profile.regions.length ? profile.regions : "kõik",
      eelistatud_objektituubid: profile.categories.length ? profile.categories : "pole määratud",
    },
    kasutaja_eelistused: liked.length
      ? `Kasutaja on varem lemmikuks märkinud sarnaseid objekte: ${liked.join("; ")}`
      : "Kasutaja pole veel lemmikuid märkinud.",
    tanane_kuupaev: new Date().toISOString().slice(0, 10),
    vihjed: leads.map((l) => ({
      id: l.id,
      nimetus: l.buildingName,
      kategooria: l.category,
      dokumendi_liik: l.docType,
      aadress: l.address.slice(0, 200),
      maakond: l.county,
      regioon: l.region,
      seisund: l.status,
      kuupaev: l.date,
    })),
  });
}

function errorMessage(status: number, model: string, detail: string): string {
  if (status === 401) return "OpenAI API võti on vigane või aegunud.";
  if (status === 429) return "OpenAI päringulimiit või krediit on täis.";
  if (status === 404 || /model/i.test(detail)) return `OpenAI mudel „${model}” pole selle võtmega saadaval.`;
  return `OpenAI päring ebaõnnestus (kood ${status}).`;
}

/** Scores leads with OpenAI. Returns only the results the model produced; callers fill gaps locally. */
export async function scoreWithOpenAI(
  apiKey: string,
  profile: CompanyProfile,
  prefs: UserPreferences | undefined,
  leads: LeadInput[],
  model = DEFAULT_MODEL,
): Promise<Record<string, LeadScore>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_schema", json_schema: RESPONSE_SCHEMA },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(profile, prefs, leads) },
        ],
      }),
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw new OpenAIError("OpenAI ei vastanud õigel ajal.");
    throw new OpenAIError("OpenAI-ga ei saanud ühendust.");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new OpenAIError(errorMessage(res.status, model, detail), res.status);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string; refusal?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new OpenAIError("OpenAI vastus oli tühi.");

  let parsed: { results?: { id?: unknown; score?: unknown; reason?: unknown; suggestedAction?: unknown }[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new OpenAIError("OpenAI vastust ei õnnestunud lugeda.");
  }

  const ids = new Set(leads.map((l) => l.id));
  const out: Record<string, LeadScore> = {};
  for (const r of parsed.results ?? []) {
    const id = typeof r.id === "string" ? r.id : "";
    if (!ids.has(id)) continue;
    const score = Math.max(1, Math.min(100, Math.round(Number(r.score) || 1)));
    const reason = String(r.reason ?? "").trim().slice(0, 300);
    const suggestedAction = String(r.suggestedAction ?? "").trim().slice(0, 40);
    if (reason) out[id] = { score, reason, suggestedAction: suggestedAction || "Jälgi projekti arengut", source: "openai" };
  }
  return out;
}
