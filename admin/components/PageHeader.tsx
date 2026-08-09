import { type LucideIcon } from "lucide-react";

// One consistent page-title treatment (icon in a tinted circle + title
// + optional subtitle/count) instead of a bare `<h1>` per page — same
// idea as the sidebar's icons, applied to the page itself so the icon
// that got you here is the first thing you see once you land.
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "#E6F1FB",
          color: "#0C447C",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={18} strokeWidth={2} />
      </div>
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 13, color: "#5F5E5A", marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}
