"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}

/** Slide-over panel used for filters on small screens. */
export default function FilterDrawer({ open, onClose, title, footer, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label="Sulge filtrid"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-page shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="tap -mr-2 text-slate-500 hover:text-slate-900" aria-label="Sulge" tabIndex={open ? 0 : -1}>
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{open && children}</div>
        {footer && (
          <div className="border-t border-slate-200 bg-white p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}
