import { formatDate, todayIso } from "./format";
import type { Lead } from "./types";

export type ExportFormat = "xlsx" | "csv";

interface Column {
  header: string;
  /** Excel column width in characters */
  width: number;
  get: (l: Lead) => string;
}

const COLUMNS: Column[] = [
  { header: "Dokumendi kuupäev", width: 18, get: (l) => l.date },
  { header: "EHR kood", width: 12, get: (l) => l.ehrCode },
  { header: "Dokumendi number", width: 17, get: (l) => l.docNumber },
  { header: "Dokumendi liik", width: 30, get: (l) => l.docType },
  { header: "Ehitise nimetus", width: 36, get: (l) => l.buildingName },
  { header: "Kategooria", width: 22, get: (l) => l.category },
  { header: "Ehitise aadress", width: 60, get: (l) => l.address },
  { header: "Maakond", width: 18, get: (l) => l.county },
  { header: "Regioon", width: 14, get: (l) => l.region },
  { header: "Seisund", width: 18, get: (l) => l.status },
  { header: "Menetlev asutus", width: 32, get: (l) => l.authority },
];

const DATE_COL = 0;
/** Excel stores at most 32,767 characters in a cell. */
const MAX_CELL = 32_000;

/** Neutralise spreadsheet formula injection (values starting with = + - @). */
function safeText(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/* ---------------- CSV ---------------- */

function csvCell(v: string): string {
  return `"${safeText(v).replace(/"/g, '""')}"`;
}

/** Comma-separated UTF-8 CSV with BOM (RFC 4180), for importing into CRMs and Google Sheets. */
export function leadsToCsv(leads: Lead[]): string {
  const lines = [COLUMNS.map((c) => csvCell(c.header)).join(",")];
  for (const l of leads) {
    lines.push(COLUMNS.map((c, i) => csvCell(i === DATE_COL ? (l.date ? formatDate(l.date) : "") : c.get(l))).join(","));
  }
  return "﻿" + lines.join("\r\n");
}

/* ---------------- Excel ---------------- */

type XLSXModule = typeof import("xlsx");

/** YYYY-MM-DD -> Excel date serial (timezone independent). */
function excelSerial(iso: string): number | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

/** Builds an .xlsx workbook: one row per lead, real date cells, column widths and filter buttons on the header. */
export function buildLeadsWorkbook(XLSX: XLSXModule, leads: Lead[], sheetName = "Müügivihjed") {
  const rows: string[][] = [COLUMNS.map((c) => c.header)];
  for (const l of leads) rows.push(COLUMNS.map((c) => safeText(c.get(l)).slice(0, MAX_CELL)));

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Turn the date column into real Excel dates so sorting and date filters work.
  for (let r = 1; r < rows.length; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: DATE_COL });
    const serial = excelSerial(leads[r - 1].date);
    ws[addr] = serial === null ? { t: "s", v: "" } : { t: "n", v: serial, z: "dd.mm.yyyy" };
  }

  ws["!cols"] = COLUMNS.map((c) => ({ wch: c.width }));
  ws["!autofilter"] = { ref: ws["!ref"] ?? "A1" };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return wb;
}

/**
 * The free SheetJS edition does not write cell styles or frozen panes, so patch the generated
 * file: bold white-on-blue header row, header frozen while scrolling. If anything in the file
 * looks unexpected, the original (still valid) file is returned unchanged.
 */
export function styleHeaderRow(XLSX: XLSXModule, data: Uint8Array): Uint8Array {
  try {
    const zip = XLSX.CFB.read(data, { type: "array" });
    const entry = (suffix: string) => {
      const i = zip.FullPaths.findIndex((p: string) => p.endsWith(suffix));
      return i >= 0 ? zip.FileIndex[i] : null;
    };
    const stylesEntry = entry("xl/styles.xml");
    const sheetEntry = entry("xl/worksheets/sheet1.xml");
    if (!stylesEntry?.content || !sheetEntry?.content) return data;

    const dec = new TextDecoder();
    const enc = new TextEncoder();
    let styles = dec.decode(stylesEntry.content as Uint8Array);
    let sheet = dec.decode(sheetEntry.content as Uint8Array);

    const fonts = styles.match(/<fonts count="(\d+)">/);
    const fills = styles.match(/<fills count="(\d+)">/);
    const xfs = styles.match(/<cellXfs count="(\d+)">/);
    const firstRow = sheet.match(/<row r="1"[^>]*>[\s\S]*?<\/row>/);
    if (!fonts || !fills || !xfs || !firstRow || !sheet.includes('<sheetView workbookViewId="0"/>')) return data;

    const fontId = Number(fonts[1]);
    const fillId = Number(fills[1]);
    const xfId = Number(xfs[1]);
    styles = styles
      .replace(fonts[0], `<fonts count="${fontId + 1}">`)
      .replace(
        "</fonts>",
        '<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts>',
      )
      .replace(fills[0], `<fills count="${fillId + 1}">`)
      .replace("</fills>", '<fill><patternFill patternType="solid"><fgColor rgb="FF005AA3"/><bgColor indexed="64"/></patternFill></fill></fills>')
      .replace(xfs[0], `<cellXfs count="${xfId + 1}">`)
      .replace(
        /<\/cellXfs>/,
        `<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>`,
      );

    const styledRow = firstRow[0].replace(/<c r="([A-Z]+1)"/g, `<c r="$1" s="${xfId}"`);
    sheet = sheet
      .replace(firstRow[0], styledRow)
      .replace(
        '<sheetView workbookViewId="0"/>',
        '<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>',
      );

    stylesEntry.content = enc.encode(styles) as never;
    sheetEntry.content = enc.encode(sheet) as never;
    const out = XLSX.CFB.write(zip, { fileType: "zip", type: "array", compression: true }) as unknown;
    return out instanceof Uint8Array ? out : new Uint8Array(out as ArrayBuffer | number[]);
  } catch {
    return data;
  }
}

/* ---------------- Download ---------------- */

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadLeads(leads: Lead[], baseName: string, format: ExportFormat, sheetName?: string): Promise<void> {
  const fileBase = `${baseName}-${todayIso()}`;
  if (format === "csv") {
    triggerDownload(new Blob([leadsToCsv(leads)], { type: "text/csv;charset=utf-8" }), `${fileBase}.csv`);
    return;
  }
  // Load the Excel writer only when it is needed.
  const XLSX = await import("xlsx");
  const wb = buildLeadsWorkbook(XLSX, leads, sheetName);
  const raw = new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true }) as ArrayBuffer);
  const data = styleHeaderRow(XLSX, raw);
  triggerDownload(
    new Blob([data as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${fileBase}.xlsx`,
  );
}
