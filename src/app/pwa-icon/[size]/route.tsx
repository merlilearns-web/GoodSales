import { renderAppIcon } from "@/lib/iconImage";

const SIZES = ["192", "512"] as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const px = Number(size) || 192;
  // Extra padding so the glyph stays inside Android's maskable safe zone.
  return renderAppIcon(px, true);
}
