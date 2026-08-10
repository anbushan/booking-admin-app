// Design tokens mirrored from the mockups shown earlier — kept in one
// place so the whole app stays visually consistent without hardcoding
// hex values in every screen.
export const colors = {
  bg: "#F1EFE8",
  surface: "#FFFFFF",
  border: "#E3E1D8",
  textPrimary: "#1A1A18",
  textSecondary: "#5F5E5A",
  textMuted: "#888780",
  accent: "#185FA5",
  accentBg: "#E6F1FB",
  accentText: "#0C447C",
  success: "#3B6D11",
  successBg: "#EAF3DE",
  danger: "#A32D2D",
  dangerBg: "#FCEBEB",
  warning: "#854F0B",
  warningBg: "#FAEEDA",
  // Secondary accent — CTAs and driver-side highlights (see design
  // preview artifact, Phase 0). Warm counterpart to `accent`'s blue,
  // used deliberately sparingly (one bold CTA per screen, not a second
  // brand color competing with the first).
  marigold: "#D97F0A",
  marigoldBg: "#FBECD4",
  marigoldText: "#8A5406",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
};

// Every entry carries its own default `color` now, not just size/weight.
// Previously it didn't, so any style that did `{ ...typography.title }`
// without also adding its own `color` fell back to Android's platform
// default text color — normally harmless (defaults to black), but a
// standalone release APK also gets Android's "Force Dark" auto-inversion
// turned on by default (see plugins/withDisableForceDark.js for the
// other half of this fix), which specifically targets Text nodes with no
// explicit color and can flip them to white on views it can't reliably
// read the background of. That's exactly the "labels are invisible in
// the built APK" bug — an explicit color here means there's nothing
// ambiguous left for either the OS or a missed style to guess at.
export const typography = {
  title: { fontSize: 16, fontWeight: "700" as const, color: colors.textPrimary },
  body: { fontSize: 14, fontWeight: "400" as const, color: colors.textPrimary },
  caption: { fontSize: 12, fontWeight: "400" as const, color: colors.textPrimary },
  small: { fontSize: 11, fontWeight: "400" as const, color: colors.textMuted },
};

// One entry per ride/booking status string this app actually uses
// (see backend rideLifecycle.js / schema comments) — pairs a semantic
// tone (which maps to a color pair above) with an Ionicons name and a
// plain-language label, so status is never carried by a bare status
// word alone. IN_PROGRESS/COMPLETED/CANCELLED/EXPIRED are shared
// between rides and bookings; PUBLISHED is ride-only, the rest are
// booking-only — one map covers both since the meaning lines up either
// way (a look-up by whatever status string you have, ride or booking).
export type StatusTone = "go" | "wait" | "stop" | "route" | "neutral";

export const toneColors: Record<StatusTone, { bg: string; text: string }> = {
  go: { bg: colors.successBg, text: colors.success },
  wait: { bg: colors.warningBg, text: colors.warning },
  stop: { bg: colors.dangerBg, text: colors.danger },
  route: { bg: colors.accentBg, text: colors.accentText },
  neutral: { bg: colors.border, text: colors.textSecondary },
};

export const statusMeta: Record<string, { label: string; tone: StatusTone; icon: string }> = {
  PUBLISHED: { label: "Published", tone: "route", icon: "megaphone-outline" },
  BOOKED: { label: "Waiting for driver", tone: "wait", icon: "time-outline" },
  AWAITING_PAYMENT: { label: "Pay to confirm", tone: "wait", icon: "wallet-outline" },
  CHARGE_ATTEMPTED: { label: "Payment in progress", tone: "wait", icon: "time-outline" },
  PAYMENT_PENDING: { label: "Payment failed — retry", tone: "stop", icon: "alert-circle-outline" },
  CONFIRMED: { label: "Confirmed", tone: "go", icon: "checkmark-circle-outline" },
  IN_PROGRESS: { label: "On the way", tone: "route", icon: "car-outline" },
  COMPLETED: { label: "Completed", tone: "go", icon: "checkmark-done-outline" },
  CANCELLED: { label: "Cancelled", tone: "stop", icon: "close-circle-outline" },
  STOPPED: { label: "Stopped early", tone: "stop", icon: "close-circle-outline" },
  REJECTED: { label: "Declined", tone: "stop", icon: "close-circle-outline" },
  EXPIRED: { label: "Expired", tone: "stop", icon: "time-outline" },
};

export function getStatusMeta(status: string) {
  return statusMeta[status] || { label: status, tone: "neutral" as StatusTone, icon: "ellipse-outline" };
}
