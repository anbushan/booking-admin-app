export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 16px", color: "#888780" }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          background: "#E6F1FB",
          color: "#0C447C",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 12px",
          fontSize: 16,
        }}
      >
        {"\u25CB"}
      </div>
      <div style={{ fontSize: 14, color: "#5F5E5A" }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}
