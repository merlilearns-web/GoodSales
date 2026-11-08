"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Inbox, LayoutGrid, Loader2, SlidersHorizontal, Star, StarOff } from "lucide-react";
import { useAdmin } from "@/context/AdminContext";
import { useData } from "@/context/DataContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useView } from "@/context/ViewContext";
import { downloadLeads } from "@/lib/export";
import { EMPTY_FILTERS, activeFilterCount, applyFilters, buildOptions, type Filters, type SortOrder } from "@/lib/filters";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Lead } from "@/lib/types";
import ExportButton from "./ExportButton";
import FilterDrawer from "./FilterDrawer";
import FilterPanel from "./FilterPanel";
import LeadCard from "./LeadCard";

const PAGE_SIZE = 30;

export default function LeadsExplorer() {
  const { leads, meta, status, error, refresh } = useData();
  const { favorites, count: favCount, isFavorite, toggle } = useFavorites();
  const { view, setView } = useView();
  const { isAdmin, openLogin } = useAdmin();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const deferredFilters = useDeferredValue(filters);

  // Saved view: prefer the current record (fresh data), fall back to the stored snapshot.
  const savedLeads = useMemo<Lead[]>(() => {
    const byId = new Map(leads.map((l) => [l.id, l]));
    return Object.values(favorites).map((f) => byId.get(f.id) ?? f);
  }, [favorites, leads]);

  const base = view === "saved" ? savedLeads : leads;
  const options = useMemo(() => buildOptions(base), [base]);
  const results = useMemo(() => applyFilters(base, deferredFilters), [base, deferredFilters]);
  const visible = results.slice(0, limit);
  const active = activeFilterCount(filters);
  const stale = filters !== deferredFilters;

  useEffect(() => setLimit(PAGE_SIZE), [deferredFilters, view]);

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

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const savedForExport = useMemo(
    () => [...savedLeads].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [savedLeads],
  );

  const tabClass = (on: boolean) =>
    `tap flex-1 gap-2 rounded-lg px-4 text-sm font-semibold transition-colors sm:flex-none ${
      on ? "bg-white text-brand shadow-sm" : "text-slate-600 hover:text-slate-900"
    }`;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
      {/* Title + view switcher */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            {view === "saved" ? "Salvestatud müügivihjed" : "Müügivihjed"}
          </h1>
          <p className="text-sm text-slate-500">
            {meta && meta.recordCount > 0
              ? `Projekteerimistingimuste taotlused Ehitisregistrist · ${formatNumber(meta.recordCount)} kirjet`
              : "Projekteerimistingimuste taotlused Ehitisregistrist"}
          </p>
        </div>
        <div className="flex rounded-xl bg-slate-200/70 p-1" role="tablist" aria-label="Vaade">
          <button type="button" role="tab" aria-selected={view === "all"} className={tabClass(view === "all")} onClick={() => setView("all")}>
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Kõik müügivihjed
          </button>
          <button type="button" role="tab" aria-selected={view === "saved"} className={tabClass(view === "saved")} onClick={() => setView("saved")}>
            <Star className="h-4 w-4" aria-hidden />
            Salvestatud / Lemmikud
            {favCount > 0 && <span className="rounded-full bg-brand px-1.5 text-xs text-white">{favCount}</span>}
          </button>
        </div>
      </div>

      {/* Desktop filter bar */}
      <section className="mb-4 hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:block" aria-label="Filtrid">
        <FilterPanel filters={filters} onChange={setFilters} options={options} variant="bar" />
      </section>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setDrawerOpen(true)} className="btn-secondary lg:hidden" aria-haspopup="dialog">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filtrid
          {active > 0 && <span className="rounded-full bg-brand px-1.5 text-xs text-white">{active}</span>}
        </button>

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
        </label>

        <div className="flex w-full gap-2 sm:w-auto">
          <ExportButton
            label="Ekspordi tulemused"
            icon={<Download className="h-4 w-4" aria-hidden />}
            disabled={results.length === 0}
            title="Ekspordi praegused filtreeritud tulemused Exceli või CSV-failina"
            className="flex-1 sm:flex-none"
            align="left"
            onExport={(format) =>
              downloadLeads(
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Laadin müügivihjeid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
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
      ) : view === "all" && leads.length === 0 ? (
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
      ) : view === "saved" && savedLeads.length === 0 ? (
        <EmptyState
          icon={<StarOff className="h-8 w-8 text-slate-400" aria-hidden />}
          title="Salvestatud müügivihjeid pole"
          text="Vajuta kaardil tärni, et lisada müügivihje lemmikutesse. Lemmikud salvestatakse selles brauseris."
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
            <button type="button" className="btn-primary" onClick={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })}>
              Lähtesta filtrid
            </button>
          }
        />
      ) : (
        <>
          <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 ${stale ? "opacity-70" : ""}`}>
            {visible.map((lead) => (
              <LeadCard key={lead.id} lead={lead} favorite={isFavorite(lead.id)} onToggleFavorite={toggle} />
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

      {/* Mobile filter drawer */}
      <FilterDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title="Filtrid"
        footer={
          <button type="button" className="btn-primary w-full" onClick={closeDrawer}>
            Näita {formatNumber(results.length)} tulemust
          </button>
        }
      >
        <FilterPanel filters={filters} onChange={setFilters} options={options} variant="drawer" />
      </FilterDrawer>
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
