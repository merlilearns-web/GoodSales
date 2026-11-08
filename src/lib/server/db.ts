import "server-only";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __goodsalesPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __goodsalesSchemaReady: Promise<void> | undefined;
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function getPool(): Pool {
  if (!globalThis.__goodsalesPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL puudub");
    const isInternal = /\.railway\.internal|localhost|127\.0\.0\.1/.test(url);
    globalThis.__goodsalesPool = new Pool({
      connectionString: url,
      max: 5,
      ssl: isInternal ? undefined : { rejectUnauthorized: false },
    });
  }
  return globalThis.__goodsalesPool;
}

async function ensureSchema(): Promise<void> {
  if (!globalThis.__goodsalesSchemaReady) {
    globalThis.__goodsalesSchemaReady = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS goodsales_dataset (
          id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
          mode        TEXT NOT NULL,
          file_name   TEXT NOT NULL,
          sheet_name  TEXT NOT NULL DEFAULT '',
          record_count INTEGER NOT NULL DEFAULT 0,
          uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          leads       JSONB NOT NULL DEFAULT '[]'::jsonb
        )`,
      )
      .then(() => undefined)
      .catch((err) => {
        globalThis.__goodsalesSchemaReady = undefined;
        throw err;
      });
  }
  return globalThis.__goodsalesSchemaReady;
}

export async function query<T extends Record<string, unknown>>(text: string, params: unknown[] = []) {
  await ensureSchema();
  return getPool().query<T>(text, params);
}
