"use client";

import { CalendarDays, RotateCcw, Search, X } from "lucide-react";
import { EMPTY_FILTERS, activeFilterCount, type FilterOptions, type Filters } from "@/lib/filters";
import { todayIso } from "@/lib/format";
import MultiSelect from "./MultiSelect";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  options: FilterOptions;
  variant: "bar" | "drawer";
}

const PRESETS = [
  { label: "7 päeva", days: 7 },
  { label: "30 päeva", days: 30 },
  { label: "90 päeva", days: 90 },
];

export default function FilterPanel({ filters, onChange, options, variant }: Props) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });
  const msVariant = variant === "drawer" ? "inline" : "popover";
  const active = activeFilterCount(filters);
  const today = todayIso();
  const presetActive = (days: number) => filters.dateFrom === todayIso(-days) && (!filters.dateTo || filters.dateTo === today);

  const search = (
    <div className={variant === "bar" ? "lg:col-span-2" : ""}>
      <label htmlFor={`q-${variant}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Otsing
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          id={`q-${variant}`}
          type="search"
          inputMode="search"
          value={filters.query}
          onChange={(e) => set("query", e.target.value)}
          placeholder="Ehitise nimetus või aadress…"
          title="Otsi ehitise nimetuse või aadressi järgi"
          className="input pl-9 pr-11"
        />
        {filters.query && (
          <button
            type="button"
            onClick={() => set("query", "")}
            className="tap absolute right-0 top-0 text-slate-400 hover:text-slate-700"
            aria-label="Tühjenda otsing"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  const dates = (
    <div className={variant === "bar" ? "lg:col-span-2" : ""}>
      <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
        Dokumendi kuupäev
      </span>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="sr-only">Alates</span>
          <input
            type="date"
            value={filters.dateFrom}
            max={filters.dateTo || undefined}
            onChange={(e) => set("dateFrom", e.target.value)}
            className="input"
            aria-label="Kuupäev alates"
            title="Kuupäev alates"
          />
        </label>
        <label className="block">
          <span className="sr-only">Kuni</span>
          <input
            type="date"
            value={filters.dateTo}
            min={filters.dateFrom || undefined}
            onChange={(e) => set("dateTo", e.target.value)}
            className="input"
            aria-label="Kuupäev kuni"
            title="Kuupäev kuni"
          />
        </label>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => onChange({ ...filters, dateFrom: todayIso(-p.days), dateTo: "" })}
            className={`chip ${presetActive(p.days) ? "chip-active" : ""}`}
            title={`Viimased ${p.label}`}
          >
            {p.label}
          </button>
        ))}
        {(filters.dateFrom || filters.dateTo) && (
          <button type="button" onClick={() => onChange({ ...filters, dateFrom: "", dateTo: "" })} className="chip">
            Kõik kuupäevad
          </button>
        )}
      </div>
    </div>
  );

  const selects = (
    <>
      <MultiSelect
        label="Maakond"
        placeholder="Kõik maakonnad"
        options={options.counties}
        selected={filters.counties}
        onChange={(v) => set("counties", v)}
        variant={msVariant}
        tooltip="Filtreeri maakonna järgi"
      />
      <MultiSelect
        label="Regioon"
        placeholder="Kõik regioonid"
        options={options.regions}
        selected={filters.regions}
        onChange={(v) => set("regions", v)}
        variant={msVariant}
        tooltip="Filtreeri regiooni järgi"
      />
      <MultiSelect
        label="Ehitise tüüp"
        placeholder="Kõik tüübid"
        options={options.categories}
        selected={filters.categories}
        onChange={(v) => set("categories", v)}
        variant={msVariant}
        tooltip="Ehitise nimetuse põhjal rühmitatud kategooriad (nt Üksikelamu, Ladu, Viilhall, Korterelamu)"
      />
      <MultiSelect
        label="Seisund"
        placeholder="Kõik seisundid"
        options={options.statuses}
        selected={filters.statuses}
        onChange={(v) => set("statuses", v)}
        variant={msVariant}
        tooltip="Filtreeri menetluse seisundi järgi"
      />
    </>
  );

  const reset = active > 0 && (
    <button type="button" onClick={() => onChange({ ...EMPTY_FILTERS, sort: filters.sort })} className="btn-ghost">
      <RotateCcw className="h-4 w-4" aria-hidden />
      Lähtesta filtrid ({active})
    </button>
  );

  if (variant === "drawer") {
    return (
      <div className="flex flex-col gap-4">
        {search}
        {selects}
        {dates}
        {reset}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        {search}
        {selects}
        {dates}
      </div>
      {reset && <div className="mt-2 flex justify-end">{reset}</div>}
    </div>
  );
}
