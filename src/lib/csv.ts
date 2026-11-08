import { formatDate, todayIso } from "./format";
import type { Lead } from "./types";

const COLUMNS: { header: string; get: (l: Lead) => string }[] = [
  { header: "Dokumendi kuupäev", get: (l) => (l.date ? formatDate(l.date) : "") },
  { header: "EHR kood", get: (l) => l.ehrCode },
  { header: "Dokumendi number", get: (l) => l.docNumber },
  { header: "Dokumendi liik", get: (l) => l.docType },
  { header: "Ehitise nimetus", get: (l) => l.buildingName },
  { header: "Kategooria", get: (l) => l.category },
  { header: "Ehitise aadress", get: (l) => l.address },
  { header: "Maakond", get: (l) => l.county },
  { header: "Regioon", get: (l) => l.region },
  { header: "Seisund", get: (l) => l.status },
  { header: "Menetlev asutus", get: (l) => l.authority },
];

function escapeCell(v: string): string {
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Semicolon-separated UTF-8 CSV with BOM, which Estonian-locale Excel opens correctly. */
export function leadsToCsv(leads: Lead[]): string {
  const lines = [COLUMNS.map((c) => escapeCell(c.header)).join(";")];
  for (const l of leads) lines.push(COLUMNS.map((c) => escapeCell(c.get(l))).join(";"));
  return "﻿" + lines.join("\r\n");
}

export function downloadCsv(leads: Lead[], baseName: string): void {
  const blob = new Blob([leadsToCsv(leads)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}-${todayIso()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
