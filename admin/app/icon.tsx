import { ImageResponse } from "next/og";

// Generated at build/request time rather than a shipped image file —
// there's no logo asset in this repo to point at (see the mobile app's
// own "keep the logo" request earlier: the pasted reference image has
// no file/URL this environment can read, only the rendered picture).
// This uses the two brand colors from that reference (blue + orange)
// as a simple gradient mark so the browser tab/bookmark icon isn't
// still the bare Next.js default.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #185FA5 0%, #D97F0A 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 700,
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        N
      </div>
    ),
    { ...size }
  );
}
