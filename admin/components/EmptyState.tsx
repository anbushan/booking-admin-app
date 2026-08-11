// One consistent "no data" illustration for every empty state in admin
// (rides, users, reviews, refunds...) — the same empty-fuel-gauge
// animation the mobile app uses, needle on E. Used to be a hand-drawn
// static SVG version (no shipped asset); swapped for the real animated
// GIF once one was actually provided — see docs/brand/nodata-source.gif
// for the untouched original (cropped to drop its watermark, background
// chroma-keyed to transparent).
//
// flex + minHeight is what actually centers this both ways within
// whatever space it's sitting in below a table/list — the old version
// only ever had text-align:center (horizontal only) plus fixed
// top/bottom padding, so it sat wherever that padding happened to land
// it, not truly centered in the block at all.
export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 280,
        padding: "24px 16px",
        textAlign: "center",
      }}
    >
      <img src="/nodata.gif" alt="" width={160} height={109} />
      <div style={{ fontSize: 14, color: "#5F5E5A", marginTop: 12 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}
