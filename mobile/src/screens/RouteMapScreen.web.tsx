import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

// Web build of RouteMapScreen — see LiveTrackingScreen.web.tsx /
// MapPinConfirmScreen.web.tsx for why react-native-maps can't be
// imported on web at all. Same placeholder-plus-addresses fallback as
// those, so a driver/passenger testing in a browser still sees the
// route endpoints, just not the actual map.
export default function RouteMapScreen({ route, navigation }: any) {
  useScreenView("RouteMapScreen");
  const { t } = useTranslation();
  const { sourceAddress, destAddress } = route.params;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("routeMap.title")} onBack={() => navigation.goBack()} />
      <View style={styles.mapPlaceholder}>
        <Ionicons name="map-outline" size={28} color={colors.accentText} />
        <Text style={styles.mapPlaceholderText}>{t("mapPinConfirm.notAvailableOnWeb")}</Text>
        <Text style={styles.mapPlaceholderHint}>{t("mapPinConfirm.openInMobileApp")}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t("routeMap.pickup")}</Text>
            <Text style={styles.address}>{sourceAddress}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: colors.danger }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t("routeMap.dropoff")}</Text>
            <Text style={styles.address}>{destAddress}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  mapPlaceholder: { height: 260, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.xs },
  mapPlaceholderText: { ...typography.body, color: colors.accentText, textAlign: "center" },
  mapPlaceholderHint: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
  body: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  label: { ...typography.caption, color: colors.textSecondary },
  address: { ...typography.body, marginTop: 2 },
});
