import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { parseLeadsWorkbook } from "../parseLeads";
import type { DatasetMeta, DatasetMode, DatasetPayload, Lead } from "../types";
import { hasDatabase, query } from "./db";

/**
 * Dataset store.
 * - With DATABASE_URL (Railway Postgres): the admin's override (uploaded file or "empty") is stored in
 *   table goodsales_dataset and shared by every server instance and visitor.
 * - Without it: the override is kept in server memory (lost on restart).
 * - No override: the default Excel file in /public is served.
 */

interface Override {
  mode: Exclude<DatasetMode, "default">;
  fileName: string;
  sheetName: string;
  uploadedAt: string;
  leads: Lead[];
}

interface DefaultCache {
  fileName: string;
  sheetName: string;
  mtimeMs: number;
  leads: Lead[];
}

declare global {
  // eslint-disable-next-line no-var
  var __goodsalesMemoryOverride: Override | null | undefined;
  // eslint-disable-next-line no-var
  var __goodsalesDefaultCache: DefaultCache | undefined;
  // eslint-disable-next-line no-var
  var __goodsalesDbCache: { uploadedAt: string; payload: DatasetPayload } | undefined;
}

const PUBLIC_DIR = path.join(process.cwd(), "public");

async function findDefaultFile(): Promise<string | null> {
  const configured = process.env.DEFAULT_DATASET_FILE;
  if (configured) return configured;
  try {
    const files = await fs.readdir(PUBLIC_DIR);
    return files.filter((f) => f.toLowerCase().endsWith(".xlsx")).sort()[0] ?? null;
  } catch {
    return null;
  }
}

async function loadDefault(): Promise<DefaultCache | null> {
  const fileName = await findDefaultFile();
  if (!fileName) return null;
  const fullPath = path.join(PUBLIC_DIR, fileName);
  let stat;
  try {
    stat = await fs.stat(fullPath);
  } catch {
    return null;
  }
  const cached = globalThis.__goodsalesDefaultCache;
  if (cached && cached.fileName === fileName && cached.mtimeMs === stat.mtimeMs) return cached;

  const buf = await fs.readFile(fullPath);
  const { leads, sheetName } = parseLeadsWorkbook(buf);
  const entry: DefaultCache = { fileName, sheetName, mtimeMs: stat.mtimeMs, leads };
  globalThis.__goodsalesDefaultCache = entry;
  return entry;
}

function storage(): DatasetMeta["storage"] {
  return hasDatabase() ? "database" : "memory";
}

async function readOverrideMeta(): Promise<Omit<Override, "leads"> | null> {
  if (!hasDatabase()) {
    const o = globalThis.__goodsalesMemoryOverride;
    return o ? { mode: o.mode, fileName: o.fileName, sheetName: o.sheetName, uploadedAt: o.uploadedAt } : null;
  }
  const res = await query<{ mode: string; file_name: string; sheet_name: string; uploaded_at: Date }>(
    "SELECT mode, file_name, sheet_name, uploaded_at FROM goodsales_dataset WHERE id = 1",
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    mode: row.mode as Override["mode"],
    fileName: row.file_name,
    sheetName: row.sheet_name,
    uploadedAt: new Date(row.uploaded_at).toISOString(),
  };
}

function defaultMeta(def: DefaultCache | null): DatasetMeta {
  return {
    fileName: def?.fileName ?? "",
    sheetName: def?.sheetName ?? "",
    recordCount: def?.leads.length ?? 0,
    uploadedAt: null,
    mode: "default",
    version: `default:${def?.fileName ?? "none"}:${def?.mtimeMs ?? 0}`,
    storage: storage(),
  };
}

function overrideMeta(o: Omit<Override, "leads">, count: number): DatasetMeta {
  return {
    fileName: o.fileName,
    sheetName: o.sheetName,
    recordCount: count,
    uploadedAt: o.uploadedAt,
    mode: o.mode,
    version: `${o.mode}:${o.uploadedAt}`,
    storage: storage(),
  };
}

export async function getDatasetMeta(): Promise<DatasetMeta> {
  const o = await readOverrideMeta();
  if (!o) return defaultMeta(await loadDefault());
  if (!hasDatabase()) return overrideMeta(o, globalThis.__goodsalesMemoryOverride?.leads.length ?? 0);
  const res = await query<{ record_count: number }>("SELECT record_count FROM goodsales_dataset WHERE id = 1");
  return overrideMeta(o, res.rows[0]?.record_count ?? 0);
}

export async function getDataset(): Promise<DatasetPayload> {
  if (!hasDatabase()) {
    const o = globalThis.__goodsalesMemoryOverride;
    if (o) return { meta: overrideMeta(o, o.leads.length), leads: o.leads };
    const def = await loadDefault();
    return { meta: defaultMeta(def), leads: def?.leads ?? [] };
  }

  const o = await readOverrideMeta();
  if (!o) {
    const def = await loadDefault();
    return { meta: defaultMeta(def), leads: def?.leads ?? [] };
  }
  const cached = globalThis.__goodsalesDbCache;
  if (cached && cached.uploadedAt === o.uploadedAt) return cached.payload;

  const res = await query<{ leads: Lead[] }>("SELECT leads FROM goodsales_dataset WHERE id = 1");
  const leads = res.rows[0]?.leads ?? [];
  const payload = { meta: overrideMeta(o, leads.length), leads };
  globalThis.__goodsalesDbCache = { uploadedAt: o.uploadedAt, payload };
  return payload;
}

async function saveOverride(o: Override): Promise<void> {
  if (!hasDatabase()) {
    globalThis.__goodsalesMemoryOverride = o;
    return;
  }
  await query(
    `INSERT INTO goodsales_dataset (id, mode, file_name, sheet_name, record_count, uploaded_at, leads)
     VALUES (1, $1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       mode = EXCLUDED.mode, file_name = EXCLUDED.file_name, sheet_name = EXCLUDED.sheet_name,
       record_count = EXCLUDED.record_count, uploaded_at = EXCLUDED.uploaded_at, leads = EXCLUDED.leads`,
    [o.mode, o.fileName, o.sheetName, o.leads.length, o.uploadedAt, JSON.stringify(o.leads)],
  );
  globalThis.__goodsalesDbCache = undefined;
}

export async function replaceDataset(fileName: string, data: ArrayBuffer): Promise<DatasetMeta> {
  const { leads, sheetName } = parseLeadsWorkbook(new Uint8Array(data));
  if (leads.length === 0) throw new Error("Failis ei leitud ühtegi kirjet.");
  await saveOverride({ mode: "custom", fileName, sheetName, uploadedAt: new Date().toISOString(), leads });
  return getDatasetMeta();
}

export async function clearDataset(): Promise<DatasetMeta> {
  await saveOverride({ mode: "empty", fileName: "", sheetName: "", uploadedAt: new Date().toISOString(), leads: [] });
  return getDatasetMeta();
}

export async function resetToDefault(): Promise<DatasetMeta> {
  if (!hasDatabase()) {
    globalThis.__goodsalesMemoryOverride = null;
  } else {
    await query("DELETE FROM goodsales_dataset WHERE id = 1");
    globalThis.__goodsalesDbCache = undefined;
  }
  return getDatasetMeta();
}
