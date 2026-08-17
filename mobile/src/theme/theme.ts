// Design tokens mirrored from the mockups shown earlier — kept in one
// place so the whole app stays visually consistent without hardcoding
// hex values in every screen.
export const colors = {
  // Was a warm cream (#F1EFE8) — switched to pure white to match
  // Rapido's cleaner, flatter look. `surface` (cards/rows) was already
  // white, so cards no longer sit on a visibly different background —
  // they still read as distinct because every one of them already
  // carries its own border (colors.border) and/or shadow, the same way
  // a plain white iOS grouped list relies on separators, not a
  // background-color difference, to show where one card ends and the
  // next begins.
  bg: "#FFFFFF",
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

// Font family — Poppins, loaded via @expo-google-fonts/poppins (see
// App.tsx's useFonts gate, which holds the app on a blank screen for the
// ~one-time load rather than flashing system-font text that then swaps).
// Picked to match the rounded, confident, geometric-grotesque feel of
// Zomato's own app type — their actual typeface (Okra) is commercially
// licensed exclusively to them, not something that can legally be
// downloaded and bundled here. Poppins is the closest widely-used open
// alternative with the same rounded terminals and weight range, which is
// exactly why it's already the de facto "Zomato/Swiggy-adjacent" choice
// across Indian consumer apps.
//
// RN doesn't reliably synthesize bold/medium weights for a custom font —
// `fontWeight` alone silently does nothing on Android once a custom
// `fontFamily` is set (a well-known RN limitation, not a bug introduced
// here). Each weight needs its own named font family instead; every
// `fontWeight: "700"` override elsewhere in the app is now paired with
// `fontFamily: FONT.bold` for exactly this reason — fontWeight is kept
// alongside it as harmless, informative metadata, not as what actually
// selects the bold glyphs.
export const FONT = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semiBold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
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
// 17/14/12/11 -> 19/16/13/12: bumped a tier up across the board to match
// Rapido's noticeably bigger, bolder type — this app's old scale was
// comparatively compact/conservative. Kept the same four tiers and the
// same relative gaps between them (title still clearly the biggest step
// up, small still clearly the smallest) rather than introducing new
// sizes, so this is a proportional resize of the existing hierarchy, not
// a new one — every screen that composes `{...typography.body}` etc.
// picks the new size up automatically with no per-screen changes needed.
export const typography = {
  title: { fontSize: 19, fontFamily: FONT.bold, fontWeight: "700" as const, color: colors.textPrimary },
  // A second, smaller title tier — every centered confirmation/action
  // screen (delete account, switch role, login passcode, start trip...)
  // independently arrived at the same `{ ...typography.title, fontSize:
  // 18 }` override, 11 times over, which is really a real second scale
  // step that just never got named. Naming it means those screens now
  // read as "using the compact title," not "each redefining the same
  // one-off tweak."
  titleCompact: { fontSize: 18, fontFamily: FONT.bold, fontWeight: "700" as const, color: colors.textPrimary },
  body: { fontSize: 16, fontFamily: FONT.regular, fontWeight: "400" as const, color: colors.textPrimary },
  caption: { fontSize: 13, fontFamily: FONT.regular, fontWeight: "400" as const, color: colors.textPrimary },
  small: { fontSize: 12, fontFamily: FONT.regular, fontWeight: "400" as const, color: colors.textMuted },
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

// labelKey points into the i18n bundle (see lib/i18n) — StatusBadge is
// the one consumer, and passes its own `t` in. Kept here (not moved
// into StatusBadge itself) since a couple of screens read the icon/tone
// directly without rendering the badge component.
export const statusMeta: Record<string, { labelKey: string; tone: StatusTone; icon: string }> = {
  PUBLISHED: { labelKey: "status.published", tone: "route", icon: "megaphone-outline" },
  BOOKED: { labelKey: "status.waitingForDriver", tone: "wait", icon: "time-outline" },
  AWAITING_PAYMENT: { labelKey: "status.payToConfirm", tone: "wait", icon: "wallet-outline" },
  CHARGE_ATTEMPTED: { labelKey: "status.paymentInProgress", tone: "wait", icon: "time-outline" },
  PAYMENT_PENDING: { labelKey: "status.paymentFailedRetry", tone: "stop", icon: "alert-circle-outline" },
  CONFIRMED: { labelKey: "status.confirmed", tone: "go", icon: "checkmark-circle-outline" },
  IN_PROGRESS: { labelKey: "status.onTheWay", tone: "route", icon: "car-outline" },
  COMPLETED: { labelKey: "status.completed", tone: "go", icon: "checkmark-done-outline" },
  CANCELLED: { labelKey: "status.cancelled", tone: "stop", icon: "close-circle-outline" },
  STOPPED: { labelKey: "status.stoppedEarly", tone: "stop", icon: "close-circle-outline" },
  REJECTED: { labelKey: "status.declined", tone: "stop", icon: "close-circle-outline" },
  EXPIRED: { labelKey: "status.expired", tone: "stop", icon: "time-outline" },
};

export function getStatusMeta(status: string) {
  return statusMeta[status] || { labelKey: "", label: status, tone: "neutral" as StatusTone, icon: "ellipse-outline" };
}
