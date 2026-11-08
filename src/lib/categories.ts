/**
 * "Ehitise nimetus" is free text (Üksikelamu, elamu, Elumaja, Viilhall, ...).
 * Group the variants into a small set of categories for filtering.
 * Order matters: the first matching rule wins.
 */
const RULES: { category: string; pattern: RegExp }[] = [
  { category: "Korterelamu", pattern: /korter/i },
  { category: "Ridaelamu / paariselamu", pattern: /rida.?elamu|ridamaja|paaris.?elamu|paarismaja|kaksik.?elamu|kaksikmaja/i },
  {
    category: "Üksikelamu",
    pattern: /elamu|elumaja|eramu|eramaja|eluhoone|elu-?\s?maja|majapidamis|talumaja|eluruum|^(mini|väike|puit)?maja$/i,
  },
  { category: "Aiamaja / suvila", pattern: /aiamaja|suvila|puhkemaja|suvemaja|suveköök|metsamaja|külalistemaja/i },
  { category: "Saun", pattern: /saun/i },
  {
    category: "Abihoone / garaaž",
    pattern:
      /abihoone|abi-?\s?hoone|kõrvalhoone|garaa|kuur|varjualune|varikatus|ait\b|panipaik|töökoda|lõõtsik|kelder|majandushoone|maj\.\s?hoone|katlamaja|pumbamaja|tehnohoone/i,
  },
  { category: "Viilhall / tootmishoone", pattern: /viilhall|hall\b|tootmis|tööstus|tehas|angaar/i },
  { category: "Ladu", pattern: /\bladu|laohoone|lao-|logistika|hoidla/i },
  {
    category: "Ärihoone",
    pattern:
      /äri|kaubandus|kauplus|büroo|kontor|hotell|hostel|majutus|toitlust|restoran|kohvik|teenindus|tankla|autopesu|pesula|admin|asutusehoone/i,
  },
  {
    category: "Põllumajandushoone",
    pattern: /laut|farm|põllumajandus|kasvuhoone|tall\b|küün|sõnniku|loomapida|mesila|kanala|sigala/i,
  },
  {
    category: "Rajatis",
    pattern:
      /rajatis|päikese|elektri|alajaam|mast|piirdeaed|aed\b|tiik|kai\b|sild|trass|torustik|tuulik|parkla|terrass|kaabel|liin|kilp|side|sidevõrk|\btee\b|tee$|tänav|puurkaev|puhasti|kanal|salvesti|jõusaal|lasketiir/i,
  },
  {
    category: "Ühiskondlik hoone",
    pattern: /kool|lasteaed|spordi|haigla|kirik|seltsimaja|rahvamaja|raamatukogu|muuseum|hooldekodu/i,
  },
];

export const OTHER_CATEGORY = "Muu";

export function categorize(buildingName: string): string {
  const name = buildingName.trim();
  if (!name) return OTHER_CATEGORY;
  for (const rule of RULES) {
    if (rule.pattern.test(name)) return rule.category;
  }
  return OTHER_CATEGORY;
}

export const CATEGORY_ORDER = [...RULES.map((r) => r.category), OTHER_CATEGORY];
