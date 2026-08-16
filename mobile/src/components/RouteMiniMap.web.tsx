import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { useTranslation } from "../lib/i18n/I18nContext";

// Web build of RouteMiniMap — see RouteMapScreen.web.tsx /
// LiveTrackingScreen.web.tsx / TripPickupMap.web.tsx for why
// react-native-maps can't be imported on web at all (a build-time
// failure, not a runtime one — nothing to guard, Metro just needs a
// web-safe module to resolve to instead). Same branded-placeholder
// fallback those already use. Props deliberately loosely-typed/unused
// here — this file exists purely so Metro's platform resolution has
// something to pick for web, not to mirror the native version's
// behavior (there's no Traffic/Weather toggle without a real map).
export function RouteMiniMap(_props: {
  sourceLat: number;
  sourceLng: number;
  destLat: number;
  destLng: number;
  routePolyline?: string | null;
  height?: number;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.wrap, { height: _props.height ?? 160 }]}>
      <Ionicons name="map-outline" size={20} color={colors.accentText} />
      <Text style={styles.text}>{t("mapPinConfirm.notAvailableOnWeb")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.sm, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center", gap: spacing.xs },
  text: { ...typography.small, color: colors.accentText, textAlign: "center", paddingHorizontal: spacing.lg },
});
