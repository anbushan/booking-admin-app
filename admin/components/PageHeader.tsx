import { type LucideIcon } from "lucide-react";
import { TONE_COLORS, type Tone } from "../lib/tone";

// One consistent page-title treatment (icon in a tinted circle + title
// + optional subtitle/count) instead of a bare `<h1>` per page — same
// idea as the sidebar's icons, applied to the page itself so the icon
// that got you here is the first thing you see once you land.
//
// `tone` defaults to the original hardcoded blue, so every existing
// call site (all ~25 pages) renders unchanged unless it opts into a
// different one — same shared tone vocabulary StatCard/Badge use (see
// lib/tone.ts), so a page can now visually agree with its own stat
// cards (e.g. a danger queue page passing tone="warning") instead of
// every page's header being the same blue regardless of what it's about.
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  tone = "accent",
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  tone?: Tone;
}) {
  const { bg, fg } = TONE_COLORS[tone];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `radial-gradient(circle at 30% 30%, ${bg} 0%, ${bg} 55%, ${fg}22 100%)`,
          color: fg,
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
