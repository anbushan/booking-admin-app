import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, FONT } from "../theme/theme";
import { useTranslation } from "../lib/i18n/I18nContext";

// Shown wherever a passenger is deciding whether to trust a driver
// (search results, booking confirm/detail, trip OTP, live tracking) —
// "verified" now means either the paid Eko check passed OR the driver
// was manually approved by an admin the old way (see backend
// lib/verification.js isDriverVerified, either path counts the same).
// Always rendered (not just when verified) so "unverified" is an
// equally visible, explicit signal rather than the absence of one.
// `label` overrides the default "Verified"/"Unverified" text — used
// wherever RC and license need to read as two distinct badges (e.g.
// BookingConfirmScreen) instead of one combined "driverVerified" pill.
export function VerifiedBadge({ verified, size = "md", label }: { verified: boolean; size?: "sm" | "md"; label?: string }) {
  const { t } = useTranslation();
  const iconSize = size === "sm" ? 10 : 11;
  const fontSize = size === "sm" ? 9 : 10;

  if (verified) {
    return (
      <View style={[styles.badge, styles.verified]}>
        <Ionicons name="checkmark-circle" size={iconSize} color={colors.success} />
        <Text style={[styles.text, { color: colors.success, fontSize }]}>{label ?? t("common.verified")}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, styles.unverified]}>
      <Ionicons name="help-circle-outline" size={iconSize} color={colors.textMuted} />
      <Text style={[styles.text, { color: colors.textMuted, fontSize }]}>{label ?? t("common.unverified")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  verified: { backgroundColor: colors.successBg },
  unverified: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  text: { fontWeight: "700", fontFamily: FONT.bold },
});
