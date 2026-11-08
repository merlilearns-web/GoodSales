"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface AdminContextValue {
  isAdmin: boolean;
  checked: boolean;
  loginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  login: (password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setIsAdmin(Boolean(d?.admin)))
      .catch(() => setIsAdmin(false))
      .finally(() => setChecked(true));
  }, []);

  const login = useCallback(async (password: string) => {
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.admin) {
        setIsAdmin(true);
        return { ok: true };
      }
      return { ok: false, error: data?.error || "Sisselogimine ebaõnnestus." };
    } catch {
      return { ok: false, error: "Serveriga ei saanud ühendust." };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => undefined);
    setIsAdmin(false);
  }, []);

  return (
    <AdminContext.Provider
      value={{
        isAdmin,
        checked,
        loginOpen,
        openLogin: () => setLoginOpen(true),
        closeLogin: () => setLoginOpen(false),
        login,
        logout,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return ctx;
}
