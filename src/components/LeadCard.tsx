"use client";

import { memo, useState } from "react";
import { Calendar, Check, Copy, ExternalLink, FileText, Hash, Info, Landmark, MapPin, Star } from "lucide-react";
import { EHR_SEARCH_URL, formatDate, statusClass } from "@/lib/format";
import type { Lead } from "@/lib/types";

interface Props {
  lead: Lead;
  favorite: boolean;
  onToggleFavorite: (lead: Lead) => void;
}

function Detail({ icon: Icon, label, children }: { icon: typeof Hash; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-slate-900">{children || "—"}</dd>
    </div>
  );
}

function LeadCard({ lead, favorite, onToggleFavorite }: Props) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const longAddress = lead.address.length > 140;

  async function copyEhr() {
    try {
      await navigator.clipboard.writeText(lead.ehrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start gap-2 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusClass(lead.status)}`} title="Seisund">
              {lead.status || "Teadmata"}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600" title="Ehitise tüüp">
              {lead.category}
            </span>
          </div>
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-slate-900" title={lead.buildingName}>
            {lead.buildingName || "Nimetuseta ehitis"}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onToggleFavorite(lead)}
          className={`tap -mr-2 -mt-2 shrink-0 rounded-full transition-colors ${
            favorite ? "text-amber-500 hover:text-amber-600" : "text-slate-300 hover:text-amber-500"
          }`}
          aria-pressed={favorite}
          aria-label={favorite ? "Eemalda lemmikutest" : "Lisa lemmikutesse"}
          title={favorite ? "Eemalda lemmikutest" : "Lisa lemmikutesse"}
        >
          <Star className="h-6 w-6" fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Details */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 px-4 py-3">
        <Detail icon={Hash} label="EHR kood">
          <span className="font-mono">{lead.ehrCode}</span>
        </Detail>
        <Detail icon={FileText} label="Dokumendi number">
          <span className="font-mono">{lead.docNumber}</span>
        </Detail>
        <Detail icon={Calendar} label="Dokumendi kuupäev">
          {formatDate(lead.date)}
        </Detail>
        <Detail icon={MapPin} label="Maakond">
          {lead.county}
        </Detail>
        <Detail icon={MapPin} label="Regioon">
          {lead.region}
        </Detail>
        <Detail icon={Landmark} label="Menetlev asutus">
          {lead.authority}
        </Detail>
        <div className="col-span-2 min-w-0">
          <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            Ehitise aadress
          </dt>
          <dd className={`mt-0.5 break-words text-sm text-slate-900 ${expanded ? "" : "line-clamp-3"}`}>{lead.address || "—"}</dd>
          {longAddress && (
            <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-1 min-h-11 text-sm font-medium text-brand hover:underline sm:min-h-0">
              {expanded ? "Näita vähem" : "Näita kogu aadressi"}
            </button>
          )}
        </div>
      </dl>

      {/* Footer */}
      <div className="mt-auto border-t border-slate-100 p-4 pt-3">
        <div className="flex gap-2">
          <a
            href={EHR_SEARCH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex-1"
            title="Ava Ehitisregistri dokumentide otsing uues aknas"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Ava EHR-is
          </a>
          <button
            type="button"
            onClick={copyEhr}
            className="btn-secondary"
            title="Kopeeri EHR kood, et see EHR-i otsingusse kleepida"
            aria-label="Kopeeri EHR kood"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            <span className="hidden sm:inline">{copied ? "Kopeeritud" : "Kopeeri kood"}</span>
          </button>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          Koostöö tegemiseks võta otse ühendust omaniku/taotlejaga.
        </p>
      </div>
    </article>
  );
}

export default memo(LeadCard);
