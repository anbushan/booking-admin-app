import { ImageResponse } from "next/og";
import { BRAND_NAME, BRAND_TAGLINE } from "../lib/siteContent";

// Site-wide social-share card — every public page (home, /about, /safety,
// /pricing, /faq, /blog, /blog/[slug], /contact, /download, /legal/*)
// inherits this automatically via Next's file-convention unless it
// defines its own opengraph-image, which none of them do. Before this,
// every shared NanbaGO link (WhatsApp, Twitter, iMessage) rendered with
// no preview image at all — a real gap for a consumer app whose main
// discovery channel in India is a link forwarded in a chat.
//
// Drawn in-code rather than embedding public/logo-mark.png: this route
// can run on the edge runtime, where reading a file from `public/`
// isn't guaranteed the way it is in a normal Node server file — a
// same brand palette, code-drawn card avoids that entirely.
export const alt = `${BRAND_NAME} — ${BRAND_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          background: "#F1EFE8",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "#0C447C",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 700,
              color: "#FFFFFF",
            }}
          >
            N
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#1A1A18" }}>{BRAND_NAME}</div>
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, color: "#1A1A18", marginTop: 48, maxWidth: 880, lineHeight: 1.15 }}>
          {BRAND_TAGLINE}
        </div>
        <div style={{ fontSize: 26, color: "#5F5E5A", marginTop: 20, maxWidth: 780 }}>
          Real carpooling, not a taxi app — pickup verification, live SOS, and vetted drivers on every ride.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 44 }}>
          {["Pickup verification", "Live SOS", "Verified drivers"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                fontSize: 20,
                color: "#0C447C",
                background: "#E6F1FB",
                borderRadius: 999,
                padding: "10px 22px",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
