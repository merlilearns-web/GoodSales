export interface Lead {
  /** Stable id (document number, or row index fallback) */
  id: string;
  /** ISO date YYYY-MM-DD, or "" when unknown */
  date: string;
  ehrCode: string;
  docNumber: string;
  docType: string;
  buildingName: string;
  address: string;
  county: string;
  region: string;
  status: string;
  /** Processing authority (Menetlev asutus), when present in the file */
  authority: string;
  /** Normalised building category derived from buildingName */
  category: string;
}

export type DatasetMode = "default" | "custom" | "empty";

export interface DatasetMeta {
  fileName: string;
  recordCount: number;
  sheetName: string;
  uploadedAt: string | null;
  mode: DatasetMode;
  /** Changes every time the dataset changes; clients refetch when it differs. */
  version: string;
  /** Where the dataset lives on the server */
  storage: "database" | "memory";
}

export interface DatasetPayload {
  meta: DatasetMeta;
  leads: Lead[];
}
