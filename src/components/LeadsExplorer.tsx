"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  Inbox,
  LayoutGrid,
  Loader2,
  Pencil,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Star,
  StarOff,
} from "lucide-react";
import { useAdmin } from "@/context/AdminContext";
import { useAi } from "@/context/AiContext";
import { useData } from "@/context/DataContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useView } from "@/context/ViewContext";
import { RECOMMEND_THRESHOLD } from "@/lib/ai/types";
import { downloadLeads } from "@/lib/export";
import { EMPTY_FILTERS, activeFilterCount, applyFilters, buildOptions, type Filters, type SortOrder } from "@/lib/filters";
import { formatDateTime, formatNumber } from "@/lib/format";
import { shortCounty } from "@/lib/regions";
import type { Lead } from "@/lib/types";
import ExportButton from "./ExportButton";
import FilterPanel from "./FilterPanel";
import LeadCard from "./LeadCard";

const PAGE_SIZE = 30;
type AiSort = "score" | SortOrder;

export default function LeadsExplorer() {
  const { leads, meta, status, error, refresh } = useData();
  const { favorites, count: favCount, isFavorite, toggle } = useFavorites();
  const { view, setView } = useView();
  const { isAdmin, openLogin } = useAdmin();
  const ai = useAi();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [aiSort, setAiSort] = useState<AiSort>("score");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const deferredFilters = useDeferredValue(filters);
  const filtersId = useId();

  // Saved view: prefer the current record (fresh data), fall back to the stored snapshot.
  const savedLeads = useMemo<Lead[]>(() => {
    const byId = new Map(leads.map((l) => [l.id, l]));
    return Object.values(favorites).map((f) => byId.get(f.id) ?? f);
  }, [favorites, leads]);

  // "AI soovitused": only leads that match the profile well enough.
  const recommended = useMemo(
    () => leads.filter((l) => (ai.scores[l.id]?.score ?? 0) >= RECOMMEND_THRESHOLD),
    [leads, ai.scores],
  );

  const base = view === "saved" ? savedLeads : view === "ai" ? recommended : leads;
  const options = useMemo(() => buildOptions(base), [base]);
  const results = useMemo(() => {
    if (view !== "ai") return applyFilters(base, deferredFilters);
    const list = applyFilters(base, { ...deferredFilters, sort: aiSort === "oldest" ? "oldest" : "newest" });
    if (aiSort === "score") list.sort((a, b) => (ai.scores[b.id]?.score ?? 0) - (ai.scores[a.id]?.score ?? 0));
    return list;
  }, [base, deferredFilters, view, aiSort, ai.scores]);
  const visible = results.slice(0, limit);
  const active = activeFilterCount(filters);
  const stale = filters !== deferredFilters;

  useEffect(() => setLimit(PAGE_SIZE), [deferredFilters, view, aiSort]);

  // Infinite scroll: load the next page when the sentinel scrolls into view.
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = results.length > limit;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && setLimit((l) => l + PAGE_SIZE),
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, results, limit]);

  const savedForExport = useMemo(
    () => [...savedLeads].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [savedLeads],
  );

  const tabClass = (on: boolean) =>
    `tap flex-1 gap-1.5 whitespace-nowrap rounded-lg px-2 text-sm font-semibold transition-colors sm:flex-none sm:gap-2 sm:px-4 ${
      on ? "bg-white text-brand shadow-sm" : "text-slate-600 hover:text-slate-900"
    }`;

  const info = ai.info;
  const engineLabel = info?.engine === "openai" ? `OpenAI (${info.model ?? "gpt-4o-mini"}) + lokaalne algoritm` : "lokaalne sobivusalgoritm";
  const areaLabel = ai.profile.counties.length ? ai.profile.counties.map(shortCounty).join(", ") : null;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
      {/* Title + view switcher */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            {view === "saved" ? "Salvestatud müügivihjed" : view === "ai" ? "AI soovitused" : "Müügivihjed"}
          </h1>
          <p className="text-sm text-slate-500">
            {view === "ai"
              ? `Sinu ettevõtte profiiliga sobivad müügivihjed (sobivus vähemalt ${RECOMMEND_THRESHOLD}%)`
              : meta && meta.recordCount > 0
                ? `Projekteerimistingimuste taotlused Ehitisregistrist · ${formatNumber(meta.recordCount)} kirjet`
                : "Projekteerimistingimuste taotlused Ehitisregistrist"}
          </p>
        </div>
        <div className="flex rounded-xl bg-slate-200/70 p-1" role="tablist" aria-label="Vaade">
          <button
            type="button"
            role="tab"
            aria-selected={view === "ai"}
            className={`${tabClass(view === "ai")} ${view === "ai" ? "" : "text-brand ring-1 ring-inset ring-brand/30"}`}
            onClick={() => setView("ai")}
            title="Sinu profiiliga sobivaimad müügivihjed"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            <span className="sm:hidden">AI</span>
            <span className="hidden sm:inline">AI soovitused</span>
            {ai.profileReady && !ai.running && (
              <span
                className={`rounded-full px-1.5 text-xs text-white ${ai.recommendedCount > 0 ? "bg-emerald-600" : "bg-slate-400"}`}
                title={`${ai.recommendedCount} vihjet sobivusega vähemalt ${RECOMMEND_THRESHOLD}%`}
              >
                {formatNumber(ai.recommendedCount)}
              </span>
            )}
            {ai.running && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Analüüsin" />}
          </button>
          <button type="button" role="tab" aria-selected={view === "all"} className={tabClass(view === "all")} onClick={() => setView("all")}>
            <LayoutGrid className="hidden h-4 w-4 sm:block" aria-hidden />
            <span className="sm:hidden">Kõik</span>
            <span className="hidden sm:inline">Kõik müügivihjed</span>
          </button>
          <button type="button" role="tab" aria-selected={view === "saved"} className={tabClass(view === "saved")} onClick={() => setView("saved")}>
            <Star className="h-4 w-4" aria-hidden />
            <span className="sm:hidden">Lemmikud</span>
            <span className="hidden sm:inline">Salvestatud / Lemmikud</span>
            {favCount > 0 && <span className="rounded-full bg-brand px-1.5 text-xs text-white">{favCount}</span>}
          </button>
        </div>
      </div>

      {/* AI summary */}
      {view === "ai" && ai.profileReady && leads.length > 0 && (
        <section className="mb-4 rounded-xl border border-brand/20 bg-white p-4 shadow-sm" aria-label="AI analüüsi kokkuvõte">
          {ai.running && (
            <div className="mb-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-brand" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {ai.apiKey || ai.serverKey ? "Hindan vihjeid; AI täpsustab 30 parimat…" : "Hindan kõigi müügivihjete sobivust…"}
              </p>
              <div className="progress-indeterminate" aria-hidden />
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-slate-800">
                <span className="font-semibold text-emerald-700">
                  {formatNumber(ai.recommendedCount)} sobivat vihjet
                </span>{" "}
                (≥{RECOMMEND_THRESHOLD}%){info ? ` · analüüsitud kõik ${formatNumber(info.total)} kirjet` : ""}
              </p>
              {info && (
                <p className="mt-0.5 text-xs text-slate-500">
                  Hinnang: {engineLabel}
                  {info.aiCount ? ` (AI hindas ${info.aiCount} parimat)` : ""} · {formatDateTime(info.analyzedAt)}
                </p>
              )}
              <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                {areaLabel ? (
                  <>
                    Sihtpiirkond: <span className="font-medium text-slate-700">{areaLabel}</span>
                    {" · "}
                  </>
                ) : null}
                {ai.profile.description ? <span className="italic">„{ai.profile.description}”</span> : null}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => ai.openProfile()}>
                <Pencil className="h-4 w-4" aria-hidden />
                Muuda profiili
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={ai.reanalyze}
                disabled={ai.running}
                title="Hindamine toimub automaatselt; käivita uuesti, et värskendada tulemusi"
              >
                <RefreshCw className={`h-4 w-4 ${ai.running ? "animate-spin" : ""}`} aria-hidden />
                Analüüsi uuesti
              </button>
            </div>
          </div>
          {ai.warning && !ai.running && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-800" role="status">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {ai.warning}
            </p>
          )}
        </section>
      )}

      {/* Manual filters (collapsed by default) */}
      <section className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          aria-controls={filtersId}
          className="flex min-h-12 w-full items-center gap-2 rounded-xl px-4 text-left hover:bg-slate-50"
        >
          <SlidersHorizontal className="h-4 w-4 text-brand" aria-hidden />
          <span className="text-sm font-semibold text-slate-900">Manuaalsed filtrid</span>
          {active > 0 && (
            <span className="rounded-full bg-brand px-2 text-xs font-semibold text-white" aria-label={`${active} aktiivset filtrit`}>
              {active}
            </span>
          )}
          <span className="ml-auto hidden text-xs text-slate-500 sm:inline">{filtersOpen ? "Peida" : "Otsing, maakond, regioon, tüüp, seisund, kuupäev"}</span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${filtersOpen ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {filtersOpen && (
          <div id={filtersId} className="border-t border-slate-100 p-4">
            <div className="hidden lg:block">
              <FilterPanel filters={filters} onChange={setFilters} options={options} variant="bar" />
            </div>
            <div className="lg:hidden">
              <FilterPanel filters={filters} onChange={setFilters} options={options} variant="drawer" />
            </div>
          </div>
        )}
      </section>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-slate-600" aria-live="polite">
          {status === "ready" || leads.length ? (
            <>
              <span className="font-semibold text-slate-900">{formatNumber(results.length)}</span> tulemust
              {stale && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden />}
            </>
          ) : null}
        </p>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="hidden sm:inline">Järjestus</span>
          {view === "ai" ? (
            <select
              value={aiSort}
              onChange={(e) => setAiSort(e.target.value as AiSort)}
              className="input w-auto py-0"
              aria-label="Järjestus"
              title="Järjesta sobivuse või kuupäeva järgi"
            >
              <option value="score">Sobivus (kõrgeim ees)</option>
              <option value="newest">Uuemad ees</option>
              <option value="oldest">Vanemad ees</option>
            </select>
          ) : (
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value as SortOrder })}
              className="input w-auto py-0"
              aria-label="Järjestus"
              title="Järjesta dokumendi kuupäeva järgi"
            >
              <option value="newest">Uuemad ees</option>
              <option value="oldest">Vanemad ees</option>
            </select>
          )}
        </label>

        <div className="flex w-full gap-2 sm:w-auto">
          <ExportButton
            label="Ekspordi tulemused"
            icon={<Download className="h-4 w-4" aria-hidden />}
            disabled={results.length === 0}
            title="Ekspordi praegused tulemused Exceli või CSV-failina"
            className="flex-1 sm:flex-none"
            align="left"
            onExport={(format) =>
              view === "ai"
                ? downloadLeads(results, "goodsales-ai-soovitused", format, "AI soovitused", ai.scores)
                : downloadLeads(
                    results,
                    view === "saved" ? "goodsales-lemmikud-filtreeritud" : "goodsales-muugivihjed",
                    format,
                    view === "saved" ? "Lemmikud" : "Müügivihjed",
                  )
            }
          />
          <ExportButton
            label="Ekspordi lemmikud"
            icon={<Star className="h-4 w-4" aria-hidden />}
            disabled={favCount === 0}
            title="Ekspordi kõik salvestatud müügivihjed Exceli või CSV-failina"
            className="flex-1 sm:flex-none"
            align="right"
            onExport={(format) => downloadLeads(savedForExport, "goodsales-lemmikud", format, "Lemmikud")}
          />
        </div>
      </div>

      {/* Results */}
      {status === "loading" && leads.length === 0 ? (
        <SkeletonGrid count={6} />
      ) : status === "error" && leads.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-8 w-8 text-red-500" aria-hidden />}
          title="Andmete laadimine ebaõnnestus"
          text={error ?? "Proovi hiljem uuesti."}
          action={
            <button type="button" className="btn-primary" onClick={() => void refresh(true)}>
              Proovi uuesti
            </button>
          }
        />
      ) : view !== "saved" && leads.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-8 w-8 text-slate-400" aria-hidden />}
          title="Andmestik on tühi"
          text="Hetkel pole ühtegi müügivihjet. Haldur saab laadida üles uue Exceli faili."
          action={
            !isAdmin && (
              <button type="button" className="btn-secondary" onClick={openLogin}>
                Admin / Haldus
              </button>
            )
          }
        />
      ) : view === "ai" && !ai.profileReady ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8 text-brand" aria-hidden />}
          title="Seadista oma profiil, et näha AI soovitusi"
          text="Kirjelda, mida su ettevõte müüb, ja vali sobivad piirkonnad ning objektitüübid. Süsteem hindab seejärel automaatselt kõigi müügivihjete sobivust ja selgitab, miks need on sulle olulised."
          action={
            <button type="button" className="btn-primary" onClick={() => ai.openProfile()}>
              <Sparkles className="h-4 w-4" aria-hidden />
              Seadista profiil
            </button>
          }
        />
      ) : view === "ai" && ai.running && recommended.length === 0 ? (
        <SkeletonGrid count={3} />
      ) : view === "ai" && recommended.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8 text-slate-400" aria-hidden />}
          title="Sobivaid müügivihjeid ei leitud"
          text={`Ükski vihje ei saavutanud ${RECOMMEND_THRESHOLD}% sobivust. Laienda profiilis sihtpiirkondi või objektitüüpe, või vaata kõiki müügivihjeid.`}
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" className="btn-primary" onClick={() => ai.openProfile()}>
                <Pencil className="h-4 w-4" aria-hidden />
                Muuda profiili
              </button>
              <button type="button" className="btn-secondary" onClick={() => setView("all")}>
                Vaata kõiki müügivihjeid
              </button>
            </div>
          }
        />
      ) : view === "saved" && savedLeads.length === 0 ? (
        <EmptyState
          icon={<StarOff className="h-8 w-8 text-slate-400" aria-hidden />}
          title="Salvestatud müügivihjeid pole"
          text="Vajuta kaardil tärni, et lisada müügivihje lemmikutesse. Lemmikud salvestatakse selles brauseris ja aitavad AI-l sinu eelistusi õppida."
          action={
            <button type="button" className="btn-primary" onClick={() => setView("all")}>
              Vaata kõiki müügivihjeid
            </button>
          }
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<SlidersHorizontal className="h-8 w-8 text-slate-400" aria-hidden />}
          title="Filtritele vastavaid tulemusi ei leitud"
          text="Muuda otsingut või lähtesta filtrid."
          action={
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setFilters({ ...EMPTY_FILTERS, sort: filters.sort });
                setFiltersOpen(false);
              }}
            >
              Lähtesta filtrid
            </button>
          }
        />
      ) : (
        <>
          <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 ${stale || (view === "ai" && ai.running) ? "opacity-70" : ""}`}>
            {visible.map((lead) => (
              <LeadCard key={lead.id} lead={lead} favorite={isFavorite(lead.id)} onToggleFavorite={toggle} score={ai.scores[lead.id]} />
            ))}
          </div>
          {hasMore && (
            <div ref={sentinel} className="mt-6 flex justify-center">
              <button type="button" className="btn-secondary" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Näita rohkem ({formatNumber(results.length - limit)} veel)
              </button>
            </div>
          )}
        </>
      )}

      {meta && meta.mode !== "empty" && meta.fileName && (
        <p className="mt-8 text-center text-xs text-slate-400">
          Andmeallikas: {meta.fileName}
          {meta.uploadedAt ? ` · uuendatud ${formatDateTime(meta.uploadedAt)}` : ""}
        </p>
      )}
    </div>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Laadin müügivihjeid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ))}
    </div>
  );
}

function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      {icon}
      <h2 className="mt-3 text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
