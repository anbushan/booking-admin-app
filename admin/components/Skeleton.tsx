export function SkeletonBlock({ style }: { style?: React.CSSProperties }) {
  return <div className="skeleton-block" style={{ height: 16, width: "100%", ...style }} />;
}

// Skeleton for a table with the given number of columns/rows — drop-in
// replacement while a list page's data is loading.
export function SkeletonTable({ columns = 4, rows = 6 }: { columns?: number; rows?: number }) {
  return (
    <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse", fontSize: 13 }}>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r} style={{ borderBottom: "1px solid #E3E1D8" }}>
            {Array.from({ length: columns }).map((_, c) => (
              <td key={c} style={{ padding: "10px 4px" }}>
                <SkeletonBlock style={{ width: c === 0 ? "70%" : "50%" }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Skeleton for the dashboard's stat-card grid.
export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: "#F1EFE8", borderRadius: 8, padding: 16 }}>
          <SkeletonBlock style={{ width: "60%", height: 12, marginBottom: 8 }} />
          <SkeletonBlock style={{ width: "40%", height: 22 }} />
        </div>
      ))}
    </div>
  );
}

// Skeleton for the free-form card layouts used on SOS alerts, refunds,
// payment-pending, and verification-queue pages.
export function SkeletonCardList({ count = 4 }: { count?: number }) {
  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ border: "1px solid #E3E1D8", borderRadius: 8, padding: 16 }}>
          <SkeletonBlock style={{ width: "50%", height: 14, marginBottom: 8 }} />
          <SkeletonBlock style={{ width: "30%", height: 11 }} />
        </div>
      ))}
    </div>
  );
}
