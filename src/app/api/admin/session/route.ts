import { NextResponse } from "next/server";
import { ADMIN_COOKIE, checkPassword, createSessionToken, isAdmin } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET: is the current visitor logged in as admin? */
export async function GET() {
  return NextResponse.json({ admin: await isAdmin() }, { headers: { "Cache-Control": "no-store" } });
}

/** POST { password }: log in */
export async function POST(req: Request) {
  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    /* ignore */
  }
  if (!password || !checkPassword(password)) {
    // Small delay to slow down guessing.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ admin: false, error: "Vale parool." }, { status: 401 });
  }
  const { token, maxAge } = createSessionToken();
  const res = NextResponse.json({ admin: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return res;
}

/** DELETE: log out */
export async function DELETE() {
  const res = NextResponse.json({ admin: false });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
