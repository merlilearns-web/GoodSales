import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/server/auth";
import { clearDataset, getDatasetMeta, replaceDataset, resetToDefault } from "@/lib/server/dataset";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;

function forbidden() {
  return NextResponse.json({ error: "Juurdepääs keelatud. Logi sisse haldurina." }, { status: 401 });
}

function failure(err: unknown, fallback: string) {
  console.error(err);
  const message = err instanceof Error && err.message ? err.message : fallback;
  return NextResponse.json({ error: message }, { status: 400 });
}

/** GET: dataset metadata (admin view) */
export async function GET() {
  if (!(await isAdmin())) return forbidden();
  return NextResponse.json(await getDatasetMeta(), { headers: { "Cache-Control": "no-store" } });
}

/** POST multipart (file): replace the dataset with an uploaded .xlsx */
export async function POST(req: Request) {
  if (!(await isAdmin())) return forbidden();
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Fail puudub." }, { status: 400 });
    if (!/\.xlsx?$/i.test(file.name)) {
      return NextResponse.json({ error: "Lubatud on ainult Exceli failid (.xlsx)." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Fail on liiga suur (maksimaalselt 25 MB)." }, { status: 400 });
    }
    const meta = await replaceDataset(file.name, await file.arrayBuffer());
    return NextResponse.json(meta);
  } catch (err) {
    return failure(err, "Faili töötlemine ebaõnnestus.");
  }
}

/** DELETE ?action=clear|reset: empty the dataset, or go back to the default file */
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return forbidden();
  const action = new URL(req.url).searchParams.get("action");
  try {
    if (action === "reset") return NextResponse.json(await resetToDefault());
    if (action === "clear") return NextResponse.json(await clearDataset());
    return NextResponse.json({ error: "Tundmatu toiming." }, { status: 400 });
  } catch (err) {
    return failure(err, "Toiming ebaõnnestus.");
  }
}
