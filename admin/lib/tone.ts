// Single source of truth for the 5 tone colors used across admin's shared
// components (StatCard, PageHeader, Badge). All three used to hardcode
// their own bg/fg hex pairs independently — same values by luck, no
// shared source, so any future re-tuning meant editing 3 files in sync.
//
// Kept as plain hex here, not CSS custom properties (see the :root block
// in globals.css for the plain ink/border tokens that ARE var()-based) —
// PageHeader and Badge both build an alpha-suffixed color at render time
// (`${fg}22`, `${fg}33`), and `var(--x)22` isn't valid CSS. Hex-in-JS is
// what makes that string concatenation possible.
export type Tone = "accent" | "success" | "warning" | "danger" | "neutral";

export const TONE_COLORS: Record<Tone, { bg: string; fg: string }> = {
  accent: { bg: "#E6F1FB", fg: "#0C447C" },
  success: { bg: "#EAF3DE", fg: "#3B6D11" },
  warning: { bg: "#FAEEDA", fg: "#854F0B" },
  danger: { bg: "#FCEBEB", fg: "#A32D2D" },
  neutral: { bg: "#F1EFE8", fg: "#5F5E5A" },
};
