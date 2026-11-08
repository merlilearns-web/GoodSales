"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  HardDrive,
  Loader2,
  Lock,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { useAdmin } from "@/context/AdminContext";
import { useData } from "@/context/DataContext";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { DatasetMeta } from "@/lib/types";

type Notice = { kind: "success" | "error"; text: string } | null;
type Confirm = "clear" | "reset" | null;

const MODE_LABEL: Record<DatasetMeta["mode"], string> = {
  default: "Vaikeandmestik",
  custom: "Üles laaditud fail",
  empty: "Tühjendatud",
};

export default function AdminPanel() {
  const { isAdmin, checked, openLogin } = useAdmin();
  const { refresh } = useData();
  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [busy, setBusy] = useState<null | "upload" | "clear" | "reset">(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadMeta = useCallback(async () => {
    const res = await fetch("/api/admin/dataset", { cache: "no-store" });
    if (res.ok) setMeta(await res.json());
  }, []);

  useEffect(() => {
    if (isAdmin) void loadMeta();
  }, [isAdmin, loadMeta]);

  async function afterChange(res: Response, okText: (m: DatasetMeta) => string) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) openLogin();
      setNotice({ kind: "error", text: data?.error || "Toiming ebaõnnestus." });
      return;
    }
    setMeta(data as DatasetMeta);
    setNotice({ kind: "success", text: okText(data as DatasetMeta) });
    await refresh(true);
  }

  async function upload(file: File) {
    if (!/\.xlsx?$/i.test(file.name)) {
      setNotice({ kind: "error", text: "Vali Exceli fail (.xlsx)." });
      return;
    }
    setBusy("upload");
    setNotice(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/dataset", { method: "POST", body });
      await afterChange(res, (m) => `Andmestik asendatud: ${formatNumber(m.recordCount)} kirjet failist „${m.fileName}”.`);
    } catch {
      setNotice({ kind: "error", text: "Üleslaadimine ebaõnnestus. Kontrolli ühendust." });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function runAction(action: "clear" | "reset") {
    setConfirm(null);
    setBusy(action);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/dataset?action=${action}`, { method: "DELETE" });
      await afterChange(res, (m) =>
        action === "clear" ? "Andmestik on tühjendatud." : `Taastatud vaikeandmestik (${formatNumber(m.recordCount)} kirjet).`,
      );
    } catch {
      setNotice({ kind: "error", text: "Toiming ebaõnnestus. Kontrolli ühendust." });
    } finally {
      setBusy(null);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !busy) void upload(file);
  }

  if (!checked) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" aria-label="Laadin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand">
          <Lock className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Haldus on kaitstud</h1>
        <p className="mt-2 text-sm text-slate-500">Andmestiku haldamiseks logi sisse halduri parooliga.</p>
        <button type="button" onClick={openLogin} className="btn-primary mt-6">
          Logi sisse
        </button>
      </div>
    );
  }

  const stats = [
    { label: "Kirjeid kokku", value: meta ? formatNumber(meta.recordCount) : "…" },
    { label: "Aktiivne fail", value: meta ? meta.fileName || "—" : "…" },
    { label: "Tööleht", value: meta ? meta.sheetName || "—" : "…" },
    { label: "Allikas", value: meta ? MODE_LABEL[meta.mode] : "…" },
    { label: "Viimati muudetud", value: meta ? formatDateTime(meta.uploadedAt) : "…" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Haldus</h1>
      <p className="text-sm text-slate-500">Halda müügivihjete andmestikku. Muudatused jõuavad kõikide kasutajateni automaatselt.</p>

      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${
            notice.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {notice.kind === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          {notice.text}
        </div>
      )}

      {/* Metadata */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Database className="h-5 w-5 text-brand" aria-hidden />
          Aktiivne andmestik
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0 rounded-lg bg-page p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</dt>
              <dd className="mt-1 break-words text-sm font-medium text-slate-900">{s.value}</dd>
            </div>
          ))}
        </dl>
        {meta?.storage === "memory" && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <HardDrive className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Andmebaas (DATABASE_URL) pole seadistatud: üles laaditud andmed hoitakse ainult serveri mälus ja kaovad serveri taaskäivitamisel.
          </p>
        )}
      </section>

      {/* Upload */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Upload className="h-5 w-5 text-brand" aria-hidden />
          Laadi üles uus andmestik
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Uus Exceli fail asendab kehtiva andmestiku kõigi kasutajate jaoks. Fail peab sisaldama veerge „Dokumendi kuupäev”, „EHR kood”,
          „Dokumendi number”, „Dokumendi liik”, „Ehitise nimetus”, „Ehitise aadress”, „Maakond”, „Regioon” ja „Seisund”.
        </p>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragOver ? "border-brand bg-brand-50" : "border-slate-300 hover:border-brand/60 hover:bg-slate-50"
          } ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          {busy === "upload" ? (
            <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden />
          ) : (
            <FileSpreadsheet className="h-8 w-8 text-brand" aria-hidden />
          )}
          <span className="mt-3 text-sm font-semibold text-slate-900">
            {busy === "upload" ? "Töötlen faili…" : "Vali fail või lohista see siia"}
          </span>
          <span className="mt-1 text-xs text-slate-500">.xlsx, kuni 25 MB</span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={Boolean(busy)}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
        </label>
      </section>

      {/* Reset / clear */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <RotateCcw className="h-5 w-5 text-brand" aria-hidden />
          Lähtestamine
        </h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="btn-secondary"
            disabled={Boolean(busy) || meta?.mode === "default"}
            onClick={() => setConfirm("reset")}
            title="Taasta rakendusega kaasas olev algne Exceli fail"
          >
            {busy === "reset" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" aria-hidden />}
            Taasta vaikeandmestik
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={Boolean(busy) || meta?.mode === "empty"}
            onClick={() => setConfirm("clear")}
            title="Eemalda kõik müügivihjed"
          >
            {busy === "clear" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" aria-hidden />}
            Tühjenda andmestik
          </button>
        </div>
      </section>

      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
          <button type="button" aria-label="Sulge" className="absolute inset-0 bg-slate-900/50" onClick={() => setConfirm(null)} />
          <div className="relative w-full max-w-sm rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
            <h2 id="confirm-title" className="text-lg font-semibold text-slate-900">
              {confirm === "clear" ? "Tühjendada andmestik?" : "Taastada vaikeandmestik?"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {confirm === "clear"
                ? "Kõik müügivihjed eemaldatakse kõigi kasutajate jaoks. Kasutajate lemmikud jäävad nende brauserisse alles."
                : "Praegune andmestik asendatakse rakendusega kaasas oleva algse Exceli failiga."}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary" onClick={() => setConfirm(null)}>
                Tühista
              </button>
              <button type="button" className={confirm === "clear" ? "btn-danger" : "btn-primary"} onClick={() => void runAction(confirm)}>
                {confirm === "clear" ? "Tühjenda" : "Taasta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
