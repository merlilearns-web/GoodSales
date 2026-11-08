"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type LeadView = "all" | "saved";

interface ViewContextValue {
  view: LeadView;
  setView: (v: LeadView) => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<LeadView>("all");
  return <ViewContext.Provider value={{ view, setView }}>{children}</ViewContext.Provider>;
}

export function useView(): ViewContextValue {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("useView must be used inside ViewProvider");
  return ctx;
}
