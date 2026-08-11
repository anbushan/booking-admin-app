// The actual NanbaGO mark (cropped from the full logo — see
// public/logo-mark.png, generated from the brand's real logo file, not
// a placeholder). Used everywhere a small inline badge sits next to its
// own "NanbaGO" text label (sidebar, login, legal-page header), so the
// wordmark isn't baked into the image twice.
export function Logo({ size = 26 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-mark.png"
      alt="NanbaGO"
      width={size}
      height={size}
      style={{ borderRadius: "22%", flexShrink: 0, objectFit: "contain" }}
    />
  );
}
