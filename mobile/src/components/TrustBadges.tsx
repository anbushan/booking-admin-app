import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";

type Badge = { icon: keyof typeof Ionicons.glyphMap; label: string };

// Passenger and driver trust each other on faith alone right up until
// a booking's platform fee actually clears — this makes the specific,
// already-true reasons that faith is warranted visible instead of
// assumed: the platform fee itself is what makes a booking "not fake"
// (a passenger can't just tap-and-vanish, they've paid to be there),
// live tracking and the SOS button are real, shipped features
// (LiveTrackingScreen), not marketing claims, and WhatsApp updates is
// the actual opt-in checkbox on login (see OtpScreens.tsx).
const PASSENGER_BADGES: Badge[] = [
  { icon: "shield-checkmark-outline", label: "Verified drivers" },
  { icon: "ribbon-outline", label: "No fake rides — every booking is paid for" },
  { icon: "navigate-circle-outline", label: "Live-tracked for your safety" },
  { icon: "alert-circle-outline", label: "SOS button for emergencies, every trip" },
  { icon: "logo-whatsapp", label: "Get trip updates on WhatsApp" },
];

const DRIVER_BADGES: Badge[] = [
  { icon: "checkmark-done-circle-outline", label: "100% genuine bookings — fee paid upfront" },
  { icon: "shield-checkmark-outline", label: "No fake requests, no wasted trips" },
  { icon: "navigate-circle-outline", label: "Every ride tracked for safety" },
  { icon: "alert-circle-outline", label: "SOS button for emergencies, every trip" },
  { icon: "logo-whatsapp", label: "Get trip updates on WhatsApp" },
];

// Deliberately plain — text on a bordered card, not another colored
// panel competing with everything else on this screen. The rest of
// Home already leans on accent/marigold for the one or two things that
// actually need to stand out (the CTA, live badges); a trust list read
// better as calm, credible black-and-white than another bright box.
export function TrustBadges({ role }: { role?: string }) {
  const badges = role === "DRIVER" ? DRIVER_BADGES : PASSENGER_BADGES;
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="shield-checkmark" size={15} color={colors.textPrimary} />
        <Text style={styles.title}>Why ride with NanbaGO</Text>
      </View>
      {badges.map((badge) => (
        <View key={badge.label} style={styles.row}>
          <Ionicons name={badge.icon} size={15} color={colors.textPrimary} style={styles.icon} />
          <Text style={styles.label}>{badge.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  title: { ...typography.caption, fontWeight: "700", color: colors.textPrimary },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  icon: { width: 18 },
  label: { ...typography.small, color: colors.textSecondary, flex: 1, lineHeight: 16 },
});
