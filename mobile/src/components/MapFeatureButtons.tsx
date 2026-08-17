import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Pressable } from "./Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography, FONT } from "../theme/theme";
import { TrafficLegend } from "./TrafficLegend";
import { useTranslation } from "../lib/i18n/I18nContext";

// The two map-overlay toggles shared by RouteMapScreen (pre-trip route
// preview) and LiveTrackingScreen (the live, in-trip version of the same
// map) — one place for this so both stay visually/behaviorally
// identical rather than drifting apart as two separate implementations.
export function MapFeatureButtons({
  showTraffic,
  onToggleTraffic,
  showWeather,
  onToggleWeather,
  weatherLoading,
  weatherTempC,
  weatherError,
}: {
  showTraffic: boolean;
  onToggleTraffic: () => void;
  showWeather: boolean;
  onToggleWeather: () => void;
  weatherLoading: boolean;
  weatherTempC: number | null;
  weatherError?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.buttonColumn}>
        <Pressable
          style={[styles.button, showTraffic && styles.buttonActive]}
          onPress={onToggleTraffic}
          hitSlop={4}
        >
          <Ionicons name="car-sport-outline" size={16} color={showTraffic ? "#FFFFFF" : colors.textPrimary} />
          <Text style={[styles.buttonText, showTraffic && styles.buttonTextActive]}>{t("mapFeatures.viewTraffic")}</Text>
        </Pressable>
        <Pressable
          style={[styles.button, showWeather && styles.buttonActive, weatherError && styles.buttonError]}
          onPress={onToggleWeather}
          hitSlop={4}
        >
          {weatherLoading ? (
            <ActivityIndicator size="small" color={showWeather ? "#FFFFFF" : colors.textPrimary} />
          ) : weatherError ? (
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          ) : (
            <Ionicons name="partly-sunny-outline" size={16} color={showWeather ? "#FFFFFF" : colors.textPrimary} />
          )}
          <Text style={[styles.buttonText, showWeather && styles.buttonTextActive, weatherError && styles.buttonTextError]}>
            {weatherError
              ? t("mapFeatures.weatherFailed")
              : showWeather && weatherTempC != null
              ? `${weatherTempC}°C`
              : t("mapFeatures.viewWeather")}
          </Text>
        </Pressable>
      </View>
      {showTraffic && (
        <View style={styles.legendWrap}>
          <TrafficLegend />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: spacing.md, right: spacing.md, alignItems: "flex-end", gap: spacing.sm },
  buttonColumn: { gap: spacing.xs },
  button: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
  },
  buttonActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  buttonError: { backgroundColor: colors.dangerBg, borderColor: colors.danger },
  buttonText: { ...typography.small, fontWeight: "700", fontFamily: FONT.bold, color: colors.textPrimary },
  buttonTextActive: { color: "#FFFFFF" },
  buttonTextError: { color: colors.danger },
  legendWrap: { maxWidth: 220 },
});
