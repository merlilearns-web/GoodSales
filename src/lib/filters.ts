import { CATEGORY_ORDER } from "./categories";
import type { Lead } from "./types";

export type SortOrder = "newest" | "oldest";

export interface Filters {
  query: string;
  counties: string[];
  regions: string[];
  categories: string[];
  statuses: string[];
  dateFrom: string; // YYYY-MM-DD or ""
  dateTo: string; // YYYY-MM-DD or ""
  sort: SortOrder;
}

export const EMPTY_FILTERS: Filters = {
  query: "",
  counties: [],
  regions: [],
  categories: [],
  statuses: [],
  dateFrom: "",
  dateTo: "",
  sort: "newest",
};

export function activeFilterCount(f: Filters): number {
  return (
    (f.query.trim() ? 1 : 0) +
    f.counties.length +
    f.regions.length +
    f.categories.length +
    f.statuses.length +
    (f.dateFrom ? 1 : 0) +
    (f.dateTo ? 1 : 0)
  );
}

/** Lowercase + strip diacritics so "parnu" finds "Pärnu". */
export function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function applyFilters(leads: Lead[], f: Filters): Lead[] {
  const terms = fold(f.query).split(/\s+/).filter(Boolean);
  const counties = new Set(f.counties);
  const regions = new Set(f.regions);
  const categories = new Set(f.categories);
  const statuses = new Set(f.statuses);

  const out = leads.filter((l) => {
    if (counties.size && !counties.has(l.county)) return false;
    if (regions.size && !regions.has(l.region)) return false;
    if (categories.size && !categories.has(l.category)) return false;
    if (statuses.size && !statuses.has(l.status)) return false;
    if (f.dateFrom && (!l.date || l.date < f.dateFrom)) return false;
    if (f.dateTo && (!l.date || l.date > f.dateTo)) return false;
    if (terms.length) {
      const hay = fold(`${l.buildingName} ${l.address}`);
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });

  out.sort((a, b) => {
    const cmp = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    return f.sort === "newest" ? -cmp : cmp;
  });
  return out;
}

export interface Option {
  value: string;
  count: number;
}

function countBy(leads: Lead[], key: keyof Lead): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of leads) {
    const v = l[key];
    if (v) m.set(v, (m.get(v) ?? 0) + 1);
  }
  return m;
}

export function buildOptions(leads: Lead[]) {
  const alpha = (m: Map<string, number>): Option[] =>
    [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, "et"));

  const cat = countBy(leads, "category");
  const categories: Option[] = CATEGORY_ORDER.filter((c) => cat.has(c)).map((c) => ({ value: c, count: cat.get(c)! }));

  const status = countBy(leads, "status");
  const statuses = [...status.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);

  return {
    counties: alpha(countBy(leads, "county")),
    regions: alpha(countBy(leads, "region")),
    categories,
    statuses,
  };
}

export type FilterOptions = ReturnType<typeof buildOptions>;
