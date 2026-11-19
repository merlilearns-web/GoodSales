"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Brain, Check, Eraser, Eye, EyeOff, KeyRound, Info, MapPin, RotateCcw, Sparkles, Building2 } from "lucide-react";
import { useAi } from "@/context/AiContext";
import { useData } from "@/context/DataContext";
import { useView } from "@/context/ViewContext";
import { CATEGORY_ORDER, OTHER_CATEGORY } from "@/lib/categories";
import { buildOptions } from "@/lib/filters";
import { EMPTY_PROFILE, type CompanyProfile } from "@/lib/ai/types";
import { COUNTY_REGION, REGION_COUNTIES, REGIONS, detectLocations, expandToCounties, regionsCoveredBy, shortCounty } from "@/lib/regions";
import FilterDrawer from "./FilterDrawer";

const DESCRIPTION_MAX = 2000;
const PLACEHOLDER = "Müüme ja paigaldame maasoojuspumpasid ning ventilatsioonisüsteeme uutele eramutele ja ridaelamutele.";

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`chip gap-1 ${selected ? "chip-active" : ""}`}>
      {selected && <Check className="h-3.5 w-3.5" aria-hidden />}
      {label}
    </button>
  );
}

function Section({ icon: Icon, title, hint, children }: { icon: typeof Info; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Icon className="h-4 w-4 text-brand" aria-hidden />
        {title}
      </h3>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function CompanyProfilePanel() {
  const ai = useAi();
  const { leads } = useData();
  const { setView } = useView();
  const router = useRouter();
  const pathname = usePathname();

  const [draft, setDraft] = useState<CompanyProfile>(EMPTY_PROFILE);
  const [keyDraft, setKeyDraft] = useState("");
  const [showKey, setShowKey] = useState(false);

  // Load the saved values every time the panel opens.
  useEffect(() => {
    if (!ai.profileOpen) return;
    setDraft(ai.profile);
    setKeyDraft(ai.apiKey);
    setShowKey(false);
  }, [ai.profileOpen, ai.profile, ai.apiKey]);

  // Counts per county in the current dataset, shown on the chips.
  const countyCounts = useMemo(() => new Map(buildOptions(leads).counties.map((o) => [o.value, o.count])), [leads]);
  const categories = CATEGORY_ORDER.filter((c) => c !== OTHER_CATEGORY);
  const detected = useMemo(() => detectLocations(draft.description), [draft.description]);

  const toggleCategory = (value: string) =>
    setDraft((d) => ({
      ...d,
      categories: d.categories.includes(value) ? d.categories.filter((v) => v !== value) : [...d.categories, value],
    }));

  // Counties are the source of truth; a region is "selected" when all of its counties are.
  const setCounties = (counties: string[]) => setDraft((d) => ({ ...d, counties, regions: regionsCoveredBy(counties) }));
  const toggleRegion = (region: string) => {
    const members = REGION_COUNTIES[region];
    const allOn = members.every((c) => draft.counties.includes(c));
    setCounties(allOn ? draft.counties.filter((c) => !members.includes(c)) : expandToCounties([], [...draft.counties, ...members]));
  };
  const toggleCounty = (county: string) =>
    setCounties(draft.counties.includes(county) ? draft.counties.filter((c) => c !== county) : expandToCounties([], [...draft.counties, county]));

  const canAnalyze = draft.description.trim().length > 0 || draft.categories.length > 0;
  const learned = Object.entries(ai.preferences.likedCategories).sort((a, b) => b[1] - a[1]);
  const likedTotal = learned.reduce((n, [, c]) => n + c, 0);

  /** Saving always re-runs the analysis (automatic scoring). */
  function save() {
    ai.saveProfile({ ...draft, description: draft.description.trim(), regions: regionsCoveredBy(draft.counties) });
    ai.saveApiKey(keyDraft);
    ai.reanalyze();
    ai.closeProfile();
  }

  /** Clears every field in the panel and stores the empty profile and key immediately (no analysis is started). */
  function clearFields() {
    setDraft(EMPTY_PROFILE);
    setKeyDraft("");
    setShowKey(false);
    ai.saveProfile(EMPTY_PROFILE);
    ai.saveApiKey("");
  }

  function saveAndShow() {
    save();
    setView("ai");
    if (pathname !== "/") router.push("/");
  }

  return (
    <FilterDrawer
      open={ai.profileOpen}
      onClose={ai.closeProfile}
      title="Minu profiil / AI"
      icon={<Sparkles className="h-5 w-5 text-brand" aria-hidden />}
      mobileOnly={false}
      widthClass="max-w-lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-ghost text-red-600 hover:bg-red-50 sm:mr-auto"
            onClick={clearFields}
            title="Tühjenda kõik profiili väljad ja valikud"
          >
            <Eraser className="h-4 w-4" aria-hidden />
            Tühjenda väljad
          </button>
          <button type="button" className="btn-secondary" onClick={save}>
            Salvesta
          </button>
          <button type="button" className="btn-primary" disabled={!canAnalyze} onClick={saveAndShow} title={canAnalyze ? undefined : "Kirjelda tegevusala või vali objektitüübid"}>
            <Sparkles className="h-4 w-4" aria-hidden />
            Salvesta ja analüüsi
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {ai.profileHint && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="status">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {ai.profileHint}
          </p>
        )}
        <p className="text-sm text-slate-600">
          Kirjelda, mida su ettevõte müüb, ja vali eelistused. Nende põhjal hinnatakse iga müügivihje sobivust ning selgitatakse, miks see on
          sulle oluline. Profiil salvestatakse ainult selles brauseris.
        </p>

        <Section icon={Building2} title="Tegevusala / Mida müüme">
          <label htmlFor="profile-description" className="sr-only">
            Tegevusala kirjeldus
          </label>
          <textarea
            id="profile-description"
            rows={4}
            maxLength={DESCRIPTION_MAX}
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder={PLACEHOLDER}
            className="input min-h-28 py-2 leading-relaxed"
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {draft.description.length} / {DESCRIPTION_MAX}
          </p>
        </Section>

        <Section
          icon={MapPin}
          title="Eelistatud piirkonnad"
          hint="Regiooni valimine märgib kõik selle maakonnad; maakondi saab valida ka ükshaaval. Väljaspool valitud piirkondi asuvaid vihjeid ei soovitata. Kui midagi pole valitud, arvestatakse kõiki piirkondi."
        >
          <div className="flex flex-col divide-y divide-slate-100">
            {REGIONS.map((region) => {
              const members = REGION_COUNTIES[region];
              const allOn = members.every((c) => draft.counties.includes(c));
              const someOn = !allOn && members.some((c) => draft.counties.includes(c));
              return (
                <div key={region} className="flex flex-col gap-1.5 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-3">
                  <button
                    type="button"
                    onClick={() => toggleRegion(region)}
                    aria-pressed={allOn}
                    title={`Vali kõik ${region} maakonnad`}
                    className={`chip w-fit shrink-0 gap-1 font-semibold sm:w-32 sm:justify-start ${allOn ? "chip-active" : someOn ? "border-brand/50 text-brand" : ""}`}
                  >
                    {allOn && <Check className="h-3.5 w-3.5" aria-hidden />}
                    {region}
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((c) => (
                      <Chip
                        key={c}
                        label={`${shortCounty(c)}${countyCounts.has(c) ? ` · ${countyCounts.get(c)}` : ""}`}
                        selected={draft.counties.includes(c)}
                        onClick={() => toggleCounty(c)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {(detected.regions.length > 0 || detected.counties.length > 0) && (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-brand-50 p-2.5 text-xs text-brand">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Kirjelduses tuvastatud piirkond: <strong>{[...detected.regions, ...detected.counties.filter((c) => !detected.regions.includes(COUNTY_REGION[c])).map(shortCounty)].join(", ")}</strong>
                {" "}– arvestatakse ka siis, kui seda pole ülal valitud.
              </span>
            </p>
          )}
        </Section>

        <Section
          icon={Building2}
          title="Eelistatud objektitüübid"
          hint="Kui midagi pole valitud, tuletatakse sobivad objektitüübid tegevusala kirjeldusest."
        >
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <Chip key={c} label={c} selected={draft.categories.includes(c)} onClick={() => toggleCategory(c)} />
            ))}
          </div>
        </Section>

        <Section icon={KeyRound} title="OpenAI API võti (valikuline)">
          <label htmlFor="profile-apikey" className="sr-only">
            OpenAI API võti
          </label>
          <div className="relative">
            <input
              id="profile-apikey"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="sk-..."
              className="input pr-12 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="tap absolute right-0 top-0 text-slate-500 hover:text-slate-800"
              aria-label={showKey ? "Peida võti" : "Näita võtit"}
              title={showKey ? "Peida võti" : "Näita võtit"}
            >
              {showKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Sisesta OpenAI API võti sügavamaks AI-analüüsiks. Kui võti puudub, kasutab süsteem nutikat lokaalset sobivusalgoritmi.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Võti salvestatakse ainult selles brauseris ja edastatakse analüüsi ajal GoodSalesi serveri kaudu OpenAI-le. AI hindab korraga kuni 30
            kõige paremini sobivat vihjet.
          </p>
          {ai.serverKey && !keyDraft && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Serveris on OpenAI võti juba seadistatud – oma võtit pole vaja sisestada.
            </p>
          )}
        </Section>

        <Section
          icon={Brain}
          title="Õpitud eelistused"
          hint="Kui märgid müügivihje tärniga lemmikuks, arvestab süsteem sarnaseid objekte edaspidistes hinnangutes."
        >
          {likedTotal === 0 ? (
            <p className="text-sm text-slate-500">Lemmikuid pole veel märgitud.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {learned.slice(0, 8).map(([cat, n]) => (
                  <span key={cat} className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand">
                    {cat} · {n}
                  </span>
                ))}
              </div>
              <button type="button" onClick={ai.resetPreferences} className="btn-ghost mt-2 -ml-2 px-2">
                <RotateCcw className="h-4 w-4" aria-hidden />
                Lähtesta õpitud eelistused
              </button>
            </>
          )}
        </Section>
      </div>
    </FilterDrawer>
  );
}
