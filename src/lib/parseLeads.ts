import * as XLSX from "xlsx";
import { categorize } from "./categories";
import type { Lead } from "./types";

/** Estonian column header -> Lead field */
export const HEADER_MAP: Record<string, keyof Lead> = {
  "dokumendi kuupäev": "date",
  "ehr kood": "ehrCode",
  "dokumendi number": "docNumber",
  "dokumendi liik": "docType",
  "ehitise nimetus": "buildingName",
  "ehitise aadress": "address",
  maakond: "county",
  regioon: "region",
  seisund: "status",
  "menetlev asutus": "authority",
};

const REQUIRED_FIELDS: (keyof Lead)[] = ["date", "docNumber", "buildingName", "address"];

function normHeader(h: unknown): string {
  return String(h ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Accepts "dd.mm.yyyy", ISO strings, JS Dates or Excel serial numbers; returns YYYY-MM-DD or "". */
export function toIsoDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  if (typeof value === "number" && isFinite(value)) {
    const d = XLSX.SSF.parse_date_code(value);
    if (d && d.y) return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
    return "";
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  return "";
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

export interface ParseResult {
  leads: Lead[];
  sheetName: string;
}

/**
 * Parse an Excel workbook into leads. Picks the sheet whose header row matches
 * the most known Estonian columns (the export has a helper "Sheet1" as well).
 */
export function parseLeadsWorkbook(data: ArrayBuffer | Uint8Array | Buffer): ParseResult {
  const wb = XLSX.read(data, { type: "buffer", cellDates: true, dense: true });

  let best: { sheetName: string; rows: unknown[][]; headerRow: number; colMap: Map<number, keyof Lead> } | null = null;

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });
    // Header may not be on the very first row; scan the first 10 rows.
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const colMap = new Map<number, keyof Lead>();
      (rows[r] || []).forEach((h, i) => {
        const field = HEADER_MAP[normHeader(h)];
        if (field && ![...colMap.values()].includes(field)) colMap.set(i, field);
      });
      if (!best || colMap.size > best.colMap.size) {
        best = { sheetName, rows, headerRow: r, colMap };
      }
    }
  }

  if (!best || best.colMap.size === 0) {
    throw new Error("Failist ei leitud tuntud veerge (nt „Dokumendi kuupäev”, „Ehitise nimetus”).");
  }
  const found = new Set(best.colMap.values());
  const missing = REQUIRED_FIELDS.filter((f) => !found.has(f));
  if (missing.length) {
    const names = Object.entries(HEADER_MAP)
      .filter(([, f]) => missing.includes(f))
      .map(([h]) => `„${h}”`);
    throw new Error(`Failist puuduvad kohustuslikud veerud: ${names.join(", ")}.`);
  }

  const leads: Lead[] = [];
  const seen = new Set<string>();
  for (let r = best.headerRow + 1; r < best.rows.length; r++) {
    const row = best.rows[r] || [];
    const lead: Lead = {
      id: "",
      date: "",
      ehrCode: "",
      docNumber: "",
      docType: "",
      buildingName: "",
      address: "",
      county: "",
      region: "",
      status: "",
      authority: "",
      category: "",
    };
    for (const [col, field] of best.colMap) {
      lead[field] = field === "date" ? toIsoDate(row[col]) : cell(row[col]);
    }
    if (!lead.buildingName && !lead.address && !lead.docNumber) continue; // empty row

    let id = lead.docNumber || `rida-${r}`;
    if (seen.has(id)) id = `${id}#${r}`;
    seen.add(id);
    lead.id = id;
    lead.category = categorize(lead.buildingName);
    leads.push(lead);
  }

  leads.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { leads, sheetName: best.sheetName };
}
