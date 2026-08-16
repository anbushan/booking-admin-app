import { Share, Platform } from "react-native";

// A lightweight "let someone know where I am" safety share — not a
// live-updating tracking link (that would need a public, unauthenticated
// web view of a booking's location, which this app doesn't have yet and
// is a much bigger, security-sensitive undertaking: exposing live GPS
// to someone with no account at all). This is the pragmatic version
// most ride apps ship first: a one-shot message with the trip's
// details and a Maps link to wherever the driver's last GPS ping
// landed, sent through the OS share sheet (WhatsApp, SMS, anything) to
// whoever the rider wants watching out for them — same spirit as the
// SOS/emergency-contacts feature, just proactive instead of reactive.
// `t` passed in (not called via the hook) since this isn't a component —
// every call site already has it from its own useTranslation().
export function buildTripShareMessage(params: {
  t: (key: string, vars?: Record<string, any>) => string;
  otherPartyName: string;
  vehicleLabel?: string | null;
  sourceAddress: string;
  destAddress: string;
  lat: number | null;
  lng: number | null;
}) {
  const { t, otherPartyName, vehicleLabel, sourceAddress, destAddress, lat, lng } = params;
  const lines = [t("trip.shareIntro", { name: otherPartyName })];
  if (vehicleLabel) lines.push(t("trip.shareVehicleLine", { vehicle: vehicleLabel }));
  lines.push(t("trip.shareRouteLine", { source: sourceAddress, dest: destAddress }));
  if (lat != null && lng != null) {
    lines.push(t("trip.shareLocationLine", { link: `https://www.google.com/maps?q=${lat},${lng}` }));
  }
  return lines.join("\n");
}

export async function shareTrip(params: Parameters<typeof buildTripShareMessage>[0]) {
  const message = buildTripShareMessage(params);
  // Share.share throws on web (no native share sheet, and no universal
  // clipboard-write fallback worth building for a feature this
  // secondary) — every call site gates the button itself on
  // Platform.OS !== "web" already, this is just a second line of
  // defense against a stray call.
  if (Platform.OS === "web") return;
  await Share.share({ message });
}
