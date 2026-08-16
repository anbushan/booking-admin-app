import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing, typography, FONT } from "../theme/theme";
import { useTranslation } from "../lib/i18n/I18nContext";

// What react-native-maps' showsTraffic actually draws is Google's own
// live traffic tile layer — real, current-condition data, but colored by
// Google, not by us. There's no API to re-color it ourselves (the
// per-street congestion data behind those tiles isn't exposed for custom
// drawing), so the honest version of a "traffic legend" is describing
// Google's own standard color key rather than pretending we control it.
const SWATCHES = [
  { color: "#63C6A0", labelKey: "trafficLegend.clear" },
  { color: "#F0AD4E", labelKey: "trafficLegend.moderate" },
  { color: "#E24C4C", labelKey: "trafficLegend.heavy" },
  { color: "#8B1A1A", labelKey: "trafficLegend.severe" },
];

export function TrafficLegend() {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("trafficLegend.title")}</Text>
      {SWATCHES.map((s) => (
        <View key={s.labelKey} style={styles.row}>
          <View style={[styles.swatch, { backgroundColor: s.color }]} />
          <Text style={styles.label}>{t(s.labelKey)}</Text>
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
    padding: spacing.sm,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  title: { ...typography.small, fontWeight: "700", fontFamily: FONT.bold, color: colors.textSecondary, marginBottom: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  label: { ...typography.small, color: colors.textMuted },
});
