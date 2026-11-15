"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Brain, Check, Eye, EyeOff, KeyRound, Info, MapPin, RotateCcw, Sparkles, Building2 } from "lucide-react";
import { useAi } from "@/context/AiContext";
import { useData } from "@/context/DataContext";
import { useView } from "@/context/ViewContext";
import { CATEGORY_ORDER, OTHER_CATEGORY } from "@/lib/categories";
import { buildOptions } from "@/lib/filters";
import { EMPTY_PROFILE, type CompanyProfile } from "@/lib/ai/types";
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

  const options = useMemo(() => buildOptions(leads), [leads]);
  const regions = options.regions.map((o) => o.value);
  const counties = options.counties.map((o) => o.value);
  const categories = CATEGORY_ORDER.filter((c) => c !== OTHER_CATEGORY);

  const toggle = (key: "regions" | "counties" | "categories", value: string) =>
    setDraft((d) => ({ ...d, [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value] }));

  const canAnalyze = draft.description.trim().length > 0 || draft.categories.length > 0;
  const learned = Object.entries(ai.preferences.likedCategories).sort((a, b) => b[1] - a[1]);
  const likedTotal = learned.reduce((n, [, c]) => n + c, 0);

  function save() {
    ai.saveProfile({ ...draft, description: draft.description.trim() });
    ai.saveApiKey(keyDraft);
  }

  function saveAndAnalyze() {
    save();
    ai.closeProfile();
    setView("ai");
    ai.requestAnalyze();
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
            className="btn-secondary"
            onClick={() => {
              save();
              ai.closeProfile();
            }}
          >
            Salvesta
          </button>
          <button type="button" className="btn-primary" disabled={!canAnalyze} onClick={saveAndAnalyze} title={canAnalyze ? undefined : "Kirjelda tegevusala või vali objektitüübid"}>
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

        <Section icon={MapPin} title="Eelistatud piirkonnad" hint="Kui midagi pole valitud, arvestatakse kõiki piirkondi.">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Regioonid</p>
          <div className="flex flex-wrap gap-1.5">
            {regions.map((r) => (
              <Chip key={r} label={r} selected={draft.regions.includes(r)} onClick={() => toggle("regions", r)} />
            ))}
          </div>
          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Maakonnad</p>
          <div className="flex flex-wrap gap-1.5">
            {counties.map((c) => (
              <Chip key={c} label={c.replace(" maakond", "")} selected={draft.counties.includes(c)} onClick={() => toggle("counties", c)} />
            ))}
          </div>
        </Section>

        <Section
          icon={Building2}
          title="Eelistatud objektitüübid"
          hint="Kui midagi pole valitud, tuletatakse sobivad objektitüübid tegevusala kirjeldusest."
        >
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <Chip key={c} label={c} selected={draft.categories.includes(c)} onClick={() => toggle("categories", c)} />
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
