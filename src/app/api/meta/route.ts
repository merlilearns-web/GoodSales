import { NextResponse } from "next/server";
import { getDatasetMeta } from "@/lib/server/dataset";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Lightweight endpoint clients poll to detect dataset changes. */
export async function GET() {
  try {
    const meta = await getDatasetMeta();
    return NextResponse.json(meta, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/meta", err);
    return NextResponse.json({ error: "Andmete laadimine ebaõnnestus." }, { status: 500 });
  }
}
