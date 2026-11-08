"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import type { ExportFormat } from "@/lib/export";

interface Props {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  title?: string;
  className?: string;
  /** Which edge the menu lines up with, so it stays on screen on phones */
  align?: "left" | "right";
  onExport: (format: ExportFormat) => Promise<void>;
}

/** Export button with a small menu: Excel (.xlsx) for everyday use, CSV for CRM / Google Sheets imports. */
export default function ExportButton({ label, icon, disabled, title, className = "", align = "right", onExport }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function run(format: ExportFormat) {
    setOpen(false);
    setBusy(true);
    setError(false);
    try {
      await onExport(format);
    } catch {
      setError(true);
      setTimeout(() => setError(false), 4000);
    } finally {
      setBusy(false);
    }
  }

  const item = "flex min-h-11 w-full items-start gap-3 px-3 py-2 text-left hover:bg-slate-50 focus-visible:bg-slate-50";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled || busy}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
        className="btn-secondary w-full"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
        {label}
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {error && (
        <p role="alert" className="absolute left-0 top-full z-30 mt-1 whitespace-nowrap rounded-md bg-red-600 px-2 py-1 text-xs text-white">
          Eksport ebaõnnestus. Proovi uuesti.
        </p>
      )}

      {open && (
        <div role="menu" className={`absolute ${align === "left" ? "left-0" : "right-0"} z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg`}>
          <button type="button" role="menuitem" className={item} onClick={() => void run("xlsx")}>
            <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Excel (.xlsx)</span>
              <span className="block text-xs text-slate-500">Avaneb Excelis korrektsete veergudega</span>
            </span>
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => void run("csv")}>
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-slate-900">CSV</span>
              <span className="block text-xs text-slate-500">CRM-i või Google Sheetsi importimiseks</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
