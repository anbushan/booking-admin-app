import { type LucideIcon } from "lucide-react";

// Icon + big number + label — the Dashboard's stat tiles had the
// number and label already but no icon, so every card looked identical
// at a glance (all just "small grey word, big number"). An icon gives
// each one its own visual identity the same way the sidebar's icons do.
//
// Uses the shared `.admin-card`/`.admin-card-hover` classes (globals.css)
// instead of its own flat inline box — a tone-colored top accent bar and
// hover lift replace what used to be a plain white rectangle with no
// depth or interactivity at all.
export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: "accent" | "success" | "warning" | "neutral";
}) {
  const iconBg = { accent: "#E6F1FB", success: "#EAF3DE", warning: "#FAEEDA", neutral: "#F1EFE8" }[tone];
  const iconFg = { accent: "#0C447C", success: "#3B6D11", warning: "#854F0B", neutral: "#5F5E5A" }[tone];
  return (
    <div
      className="admin-card admin-card-hover"
      style={{
        padding: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderTop: `3px solid ${iconFg}`,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: iconBg,
          color: iconFg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={20} strokeWidth={2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 13, color: "#5F5E5A", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}
