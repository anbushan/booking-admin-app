import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { PREFERENCE_OPTIONS } from "../lib/ridePreferences";
import { useTranslation } from "../lib/i18n/I18nContext";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  music: "musical-notes-outline",
  pets: "paw-outline",
  smoking: "ban-outline",
};

// Read-only passenger-facing display of what a driver set in Offer a
// Ride — the data's been captured and sent to the backend since that
// screen shipped, but nowhere a passenger actually looks (search
// results, booking confirm) ever showed it back. Reuses
// PREFERENCE_OPTIONS' exact key/label/inverted mapping so "active"
// means the same thing here as it does on the driver's own screen —
// e.g. smoking:false (the default) reads as the "No smoking" chip
// being the highlighted one, not smoking:true.
export function RidePreferences({ preferences, size = "md" }: { preferences?: Record<string, boolean> | null; size?: "sm" | "md" }) {
  const { t } = useTranslation();
  if (!preferences) return null;
  const iconSize = size === "sm" ? 11 : 13;
  return (
    <View style={styles.row}>
      {PREFERENCE_OPTIONS.map((opt) => {
        const active = opt.inverted ? !preferences[opt.key] : preferences[opt.key];
        return (
          <View key={opt.key} style={[styles.chip, size === "sm" && styles.chipSm, active ? styles.chipActive : styles.chipInactive]}>
            <Ionicons name={ICONS[opt.key]} size={iconSize} color={active ? colors.success : colors.textMuted} />
            <Text style={[styles.chipText, size === "sm" && styles.chipTextSm, { color: active ? colors.success : colors.textMuted }]}>
              {t(opt.labelKey)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: 999,
    borderWidth: 1,
  },
  chipSm: { paddingVertical: 3, paddingHorizontal: spacing.xs },
  chipActive: { backgroundColor: colors.successBg, borderColor: colors.successBg },
  chipInactive: { backgroundColor: colors.bg, borderColor: colors.border },
  chipText: { ...typography.small, fontWeight: "700", fontFamily: FONT.bold },
  chipTextSm: { fontSize: 9.5 },
});
