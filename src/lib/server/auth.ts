import "server-only";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "goodsales_admin";
const SESSION_HOURS = 8;

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "admin123";
}

function secret(): string {
  return process.env.ADMIN_SECRET || createHash("sha256").update(`goodsales:${adminPassword()}`).digest("hex");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(input: string): boolean {
  // Compare hashes so timing does not leak the password length.
  const a = createHash("sha256").update(input).digest("hex");
  const b = createHash("sha256").update(adminPassword()).digest("hex");
  return safeEqual(a, b);
}

export function createSessionToken(): { token: string; maxAge: number } {
  const maxAge = SESSION_HOURS * 3600;
  const expires = String(Date.now() + maxAge * 1000);
  return { token: `${expires}.${sign(expires)}`, maxAge };
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig) return false;
  if (!safeEqual(sig, sign(expires))) return false;
  return Number(expires) > Date.now();
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}
