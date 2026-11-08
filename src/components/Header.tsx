"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, LayoutGrid, LogOut, Menu, Settings, ShieldCheck, Star, X } from "lucide-react";
import { useAdmin } from "@/context/AdminContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useView, type LeadView } from "@/context/ViewContext";

export default function Header() {
  const [open, setOpen] = useState(false);
  const { view, setView } = useView();
  const { count } = useFavorites();
  const { isAdmin, openLogin, logout } = useAdmin();
  const pathname = usePathname();
  const router = useRouter();
  const onHome = pathname === "/";

  useEffect(() => setOpen(false), [pathname]);

  function goView(v: LeadView) {
    setView(v);
    setOpen(false);
    if (!onHome) router.push("/");
    window.scrollTo({ top: 0 });
  }

  function onAdmin() {
    setOpen(false);
    if (isAdmin) router.push("/haldus");
    else openLogin();
  }

  async function onLogout() {
    setOpen(false);
    await logout();
    if (pathname.startsWith("/haldus")) router.push("/");
  }

  const navItem = (active: boolean) =>
    `tap gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
      active ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <header className="sticky top-0 z-40 bg-brand text-white shadow-sm" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" onClick={() => setView("all")} className="flex min-h-11 items-center gap-2.5" aria-label="GoodSales avaleht">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-brand">
            <Building2 className="h-5 w-5" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-bold tracking-tight">GoodSales</span>
            <span className="hidden text-xs text-white/75 sm:block">Ehituse ja arhitektuuri müügivihjed</span>
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Põhinavigatsioon">
          <button type="button" className={navItem(onHome && view === "all")} onClick={() => goView("all")}>
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Kõik müügivihjed
          </button>
          <button type="button" className={navItem(onHome && view === "saved")} onClick={() => goView("saved")}>
            <Star className="h-4 w-4" aria-hidden />
            Salvestatud
            {count > 0 && (
              <span className="rounded-full bg-white px-1.5 text-xs font-semibold text-brand" aria-label={`${count} salvestatud`}>
                {count}
              </span>
            )}
          </button>
          <span className="mx-2 h-6 w-px bg-white/25" aria-hidden />
          <button type="button" className={navItem(pathname.startsWith("/haldus"))} onClick={onAdmin}>
            {isAdmin ? <ShieldCheck className="h-4 w-4" aria-hidden /> : <Settings className="h-4 w-4" aria-hidden />}
            {isAdmin ? "Haldus" : "Admin / Haldus"}
          </button>
          {isAdmin && (
            <button type="button" className={navItem(false)} onClick={onLogout} title="Logi välja">
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="sr-only lg:not-sr-only">Logi välja</span>
            </button>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="tap -mr-2 rounded-lg text-white hover:bg-white/10 md:hidden"
          aria-label={open ? "Sulge menüü" : "Ava menüü"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div id="mobile-menu" className="border-t border-white/15 bg-brand md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3" aria-label="Mobiilne navigatsioon">
            <button type="button" className={`${navItem(onHome && view === "all")} justify-start`} onClick={() => goView("all")}>
              <LayoutGrid className="h-5 w-5" aria-hidden />
              Kõik müügivihjed
            </button>
            <button type="button" className={`${navItem(onHome && view === "saved")} justify-start`} onClick={() => goView("saved")}>
              <Star className="h-5 w-5" aria-hidden />
              Salvestatud / Lemmikud
              {count > 0 && <span className="ml-auto rounded-full bg-white px-2 text-xs font-semibold text-brand">{count}</span>}
            </button>
            <div className="my-1 h-px bg-white/15" aria-hidden />
            <button type="button" className={`${navItem(pathname.startsWith("/haldus"))} justify-start`} onClick={onAdmin}>
              {isAdmin ? <ShieldCheck className="h-5 w-5" aria-hidden /> : <Settings className="h-5 w-5" aria-hidden />}
              {isAdmin ? "Haldus" : "Admin / Haldus"}
            </button>
            {isAdmin && (
              <button type="button" className={`${navItem(false)} justify-start`} onClick={onLogout}>
                <LogOut className="h-5 w-5" aria-hidden />
                Logi välja
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
