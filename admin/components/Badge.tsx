// A colored pill for any status/role word — replacing plain colored
// text (`<span style={{color: ...}}>ACTIVE</span>`) across the admin's
// tables. A word alone takes reading; a colored pill shape reads at a
// glance the same way the mobile app's StatusBadge does, which is
// exactly the "more visual, anybody can understand" gap here — every
// table read as a wall of text with no visual hierarchy between rows.
export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_STYLES: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: "#EAF3DE", fg: "#3B6D11" },
  warning: { bg: "#FAEEDA", fg: "#854F0B" },
  danger: { bg: "#FCEBEB", fg: "#A32D2D" },
  info: { bg: "#E6F1FB", fg: "#0C447C" },
  neutral: { bg: "#F1EFE8", fg: "#5F5E5A" },
};

// Best-effort default tone from a raw status/role string, so most call
// sites can just pass `status` and get a reasonable color without
// hand-mapping every value — pass `tone` explicitly to override.
function guessTone(value: string): BadgeTone {
  const v = value.toUpperCase();
  if (["CONFIRMED", "COMPLETED", "ACTIVE", "PUBLISHED", "PAID", "APPROVED", "DRIVER"].some((s) => v.includes(s))) return "success";
  if (["PENDING", "AWAITING", "WAITING", "REVIEW", "IN_PROGRESS"].some((s) => v.includes(s))) return "warning";
  if (["CANCELLED", "REJECTED", "FAILED", "EXPIRED", "SUSPENDED", "FLAGGED", "DISABLED"].some((s) => v.includes(s))) return "danger";
  return "neutral";
}

export function Badge({ children, tone }: { children: string; tone?: BadgeTone }) {
  const resolved = tone ?? guessTone(children);
  const { bg, fg } = TONE_STYLES[resolved];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: bg,
        color: fg,
        // A faint tone-colored border — previously just a flat fill,
        // which read fine on white but blurred together with adjacent
        // pale backgrounds (a warning badge inside a warning-tinted
        // row, e.g.). Cheap (no shadow/hover — these repeat dozens of
        // times per table) but gives every pill real definition.
        border: `1px solid ${fg}33`,
        whiteSpace: "nowrap",
      }}
    >
      {children.replaceAll("_", " ")}
    </span>
  );
}
