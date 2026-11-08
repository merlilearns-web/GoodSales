import { ImageResponse } from "next/og";

/** Renders the GoodSales app icon as a PNG of the given size. */
export function renderAppIcon(size: number, padded = false) {
  const inner = padded ? Math.round(size * 0.8) : size;
  const stroke = Math.max(2, Math.round(inner * 0.055));
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#005AA3" }}>
        <svg width={inner} height={inner} viewBox="0 0 64 64" fill="none">
          <g stroke="#fff" strokeWidth={(stroke * 64) / inner} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M14 50V22l12-6v34" />
            <path d="M26 50V26h24v24" />
            <path d="M10 50h44" />
            <path d="M32 33h4M42 33h2M32 41h4M42 41h2M18 28h2M18 36h2" />
          </g>
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
