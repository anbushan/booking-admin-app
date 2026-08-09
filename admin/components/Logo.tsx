// Same blue-to-orange gradient mark as the generated favicon
// (app/icon.tsx) — a plain CSS gradient circle rather than an image
// file, for the same reason: no logo asset exists in this repo to
// point at yet.
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #185FA5 0%, #D97F0A 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: size * 0.55,
        flexShrink: 0,
      }}
    >
      N
    </div>
  );
}
