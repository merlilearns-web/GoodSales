import { NextResponse } from "next/server";
import { getDataset } from "@/lib/server/dataset";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const payload = await getDataset();
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/leads", err);
    return NextResponse.json({ error: "Andmete laadimine ebaõnnestus." }, { status: 500 });
  }
}
