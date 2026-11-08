"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, Lock, X } from "lucide-react";
import { useAdmin } from "@/context/AdminContext";

export default function AdminLoginModal() {
  const { loginOpen, closeLogin, login } = useAdmin();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loginOpen) return;
    setPassword("");
    setError(null);
    setShow(false);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeLogin();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [loginOpen, closeLogin]);

  if (!loginOpen) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    const res = await login(password);
    setBusy(false);
    if (res.ok) {
      closeLogin();
      router.push("/haldus");
    } else {
      setError(res.error ?? "Vale parool.");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="admin-login-title">
      <button type="button" aria-label="Sulge" className="absolute inset-0 bg-slate-900/50" onClick={closeLogin} />
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-sm rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand">
              <Lock className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 id="admin-login-title" className="text-lg font-semibold text-slate-900">
                Halduri sisselogimine
              </h2>
              <p className="text-sm text-slate-500">Andmestiku haldamiseks sisesta parool.</p>
            </div>
          </div>
          <button type="button" onClick={closeLogin} className="tap -mr-2 -mt-2 text-slate-500 hover:text-slate-800" aria-label="Sulge">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label htmlFor="admin-password" className="mb-1 block text-sm font-medium text-slate-700">
          Parool
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            id="admin-password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input pr-12"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "admin-login-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="tap absolute right-0 top-0 text-slate-500 hover:text-slate-800"
            aria-label={show ? "Peida parool" : "Näita parooli"}
            title={show ? "Peida parool" : "Näita parooli"}
          >
            {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {error && (
          <p id="admin-login-error" className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={closeLogin} className="btn-secondary">
            Tühista
          </button>
          <button type="submit" disabled={busy || !password} className="btn-primary">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Logi sisse
          </button>
        </div>
      </form>
    </div>
  );
}
