"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { Option } from "@/lib/filters";

interface Props {
  label: string;
  placeholder: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  /** "popover" for the desktop filter bar, "inline" (accordion) for the mobile drawer */
  variant?: "popover" | "inline";
  tooltip?: string;
}

export default function MultiSelect({ label, placeholder, options, selected, onChange, variant = "popover", tooltip }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open || variant !== "popover") return;
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
  }, [open, variant]);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  const summary =
    selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} valitud`;

  const list = (
    <ul id={listId} role="listbox" aria-multiselectable="true" aria-label={label} className="py-1">
      {options.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">Valikuid pole</li>}
      {options.map((o) => {
        const checked = selected.includes(o.value);
        return (
          <li key={o.value} role="option" aria-selected={checked}>
            <button
              type="button"
              onClick={() => toggle(o.value)}
              className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm hover:bg-slate-50 focus-visible:bg-slate-50"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  checked ? "border-brand bg-brand text-white" : "border-slate-300 bg-white"
                }`}
                aria-hidden
              >
                {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              <span className="flex-1 text-slate-800">{o.value}</span>
              <span className="text-xs tabular-nums text-slate-400">{formatNumber(o.count)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  const footer = selected.length > 0 && (
    <div className="border-t border-slate-100 px-3 py-1">
      <button type="button" onClick={() => onChange([])} className="min-h-11 text-sm font-medium text-brand hover:underline">
        Tühjenda valik
      </button>
    </div>
  );

  return (
    <div ref={rootRef} className="relative">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" title={tooltip}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
        title={tooltip}
        className={`input flex items-center justify-between gap-2 text-left ${selected.length ? "border-brand/60 text-slate-900" : "text-slate-500"}`}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && variant === "popover" && (
        <div className="absolute left-0 right-0 z-30 mt-1 min-w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="max-h-72 overflow-y-auto">{list}</div>
          {footer}
        </div>
      )}
      {open && variant === "inline" && (
        <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {list}
          {footer}
        </div>
      )}
    </div>
  );
}
