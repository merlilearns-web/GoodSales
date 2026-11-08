/** YYYY-MM-DD -> dd.mm.yyyy */
export function formatDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "—";
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("et-EE", { dateStyle: "short", timeStyle: "short" });
}

export function formatNumber(n: number): string {
  return n.toLocaleString("et-EE");
}

export function todayIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const STATUS_STYLES: Record<string, string> = {
  esitatud: "bg-sky-50 text-sky-800 ring-sky-200",
  menetluses: "bg-amber-50 text-amber-800 ring-amber-200",
  täiendamisel: "bg-orange-50 text-orange-800 ring-orange-200",
  "lubatud/teavitatud": "bg-emerald-50 text-emerald-800 ring-emerald-200",
  "registrisse kantud": "bg-teal-50 text-teal-800 ring-teal-200",
  keeldutud: "bg-red-50 text-red-700 ring-red-200",
};

export function statusClass(status: string): string {
  return STATUS_STYLES[status.toLowerCase()] ?? "bg-slate-100 text-slate-700 ring-slate-200";
}

export const EHR_SEARCH_URL = "https://livekluster.ehr.ee/ui/ehr/v1/detailsearch/DOCUMENTS_SEARCH";
