/** Estonian statistical regions (Regioon) and their counties (Maakond), as used in the EHR export. */
export const REGION_COUNTIES: Record<string, string[]> = {
  "Põhja-Eesti": ["Harju maakond"],
  "Lääne-Eesti": ["Hiiu maakond", "Lääne maakond", "Pärnu maakond", "Saare maakond"],
  "Kesk-Eesti": ["Järva maakond", "Lääne-Viru maakond", "Rapla maakond"],
  "Kirde-Eesti": ["Ida-Viru maakond"],
  "Lõuna-Eesti": ["Jõgeva maakond", "Põlva maakond", "Tartu maakond", "Valga maakond", "Viljandi maakond", "Võru maakond"],
};

export const REGIONS = Object.keys(REGION_COUNTIES);
export const COUNTIES = Object.values(REGION_COUNTIES).flat();

export const COUNTY_REGION: Record<string, string> = Object.fromEntries(
  Object.entries(REGION_COUNTIES).flatMap(([region, counties]) => counties.map((c) => [c, region])),
);

/** "Harju maakond" -> "Harju" */
export function shortCounty(county: string): string {
  return county.replace(/ maakond$/, "");
}

/** Regions whose counties are all in the given list. */
export function regionsCoveredBy(counties: string[]): string[] {
  const set = new Set(counties);
  return REGIONS.filter((r) => REGION_COUNTIES[r].every((c) => set.has(c)));
}

/** Counties of the given regions plus the given counties, without duplicates. */
export function expandToCounties(regions: string[], counties: string[]): string[] {
  const out = new Set(counties);
  for (const r of regions) for (const c of REGION_COUNTIES[r] ?? []) out.add(c);
  return COUNTIES.filter((c) => out.has(c));
}

function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Patterns on folded text (õ→o, ä→a, ö→o, ü→u), including town names and inflected forms ("Tartus", "Kesk-Eestis"). */
const REGION_PATTERNS: [string, RegExp][] = [
  ["Põhja-Eesti", /\bpohja-eesti/],
  ["Lääne-Eesti", /\blaane-eesti/],
  ["Kesk-Eesti", /\bkesk-eesti/],
  ["Kirde-Eesti", /\bkirde-eesti/],
  ["Lõuna-Eesti", /\blouna-eesti/],
];

const COUNTY_PATTERNS: [string, RegExp][] = [
  ["Harju maakond", /\bharju|\btallinn|\bmaardu|\bkeila\b|\bsaue\b|\bviimsi/],
  ["Hiiu maakond", /\bhiiu|\bkardla/],
  ["Ida-Viru maakond", /\bida-viru|\bnarva|\bjohvi|\bkohtla|\bsillamae/],
  ["Jõgeva maakond", /\bjogeva/],
  ["Järva maakond", /\bjarva|\bpaide/],
  ["Lääne maakond", /\blaanemaa|\blaane maako|\bhaapsalu/],
  ["Lääne-Viru maakond", /\blaane-viru|\brakvere/],
  ["Põlva maakond", /\bpolva/],
  ["Pärnu maakond", /\bparnu/],
  ["Rapla maakond", /\brapla/],
  ["Saare maakond", /\bsaaremaa|\bsaare maako|\bkuressaare/],
  ["Tartu maakond", /\btartu/],
  ["Valga maakond", /\bvalga\b|\bvalgamaa|\bvalga maako/],
  ["Viljandi maakond", /\bviljandi/],
  ["Võru maakond", /\bvoru/],
];

/** Finds regions and counties named in free text, e.g. "Ehitame Kesk-Eestis kortermaju" -> Järva, Lääne-Viru, Rapla. */
export function detectLocations(text: string): { regions: string[]; counties: string[] } {
  const t = fold(text);
  const regions = REGION_PATTERNS.filter(([, re]) => re.test(t)).map(([r]) => r);
  const counties = COUNTY_PATTERNS.filter(([, re]) => re.test(t)).map(([c]) => c);
  return { regions, counties: expandToCounties(regions, counties) };
}
