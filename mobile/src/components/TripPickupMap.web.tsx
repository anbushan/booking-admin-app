import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { useTranslation } from "../lib/i18n/I18nContext";

// Web build of TripPickupMap — see LiveTrackingScreen.web.tsx /
// RouteMapScreen.web.tsx for why react-native-maps can't be imported on
// web at all (not a runtime guard-able failure, a build-time one).
// Same branded-placeholder fallback those already use, kept small since
// this is an inline widget, not a full screen. Props deliberately
// unused/untyped-loosely here — this file exists purely so Metro's
// platform resolution has something web-safe to pick instead of the
// native version, not to mirror its exact behavior.
export function TripPickupMap(_props: {
  driverLat: number | null; driverLng: number | null; pickupLat: number | null; pickupLng: number | null;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <Ionicons name="map-outline" size={20} color={colors.accentText} />
      <Text style={styles.text}>{t("mapPinConfirm.notAvailableOnWeb")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", height: 100, borderRadius: radius.md, marginTop: spacing.md, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center", gap: spacing.xs },
  text: { ...typography.small, color: colors.accentText, textAlign: "center", paddingHorizontal: spacing.lg },
});
