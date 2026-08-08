import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme/theme";

// A bigger, more specific illustration than the generic EmptyState icon
// circle — a parked car over an empty dashed road, for the one screen
// where "nothing here" is the single most common thing a passenger
// sees (search results). Composed entirely from Ionicons (no image
// asset/Lottie dependency), so it costs nothing extra to ship.
export function NoRidesFound({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.container}>
      <View style={styles.scene}>
        <View style={styles.carCircle}>
          <Ionicons name="car-sport-outline" size={34} color={colors.accentText} />
        </View>
        <View style={styles.badge}>
          <Ionicons name="close" size={11} color="#FFFFFF" />
        </View>
        <View style={styles.road} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", padding: spacing.xl, marginTop: spacing.xl },
  scene: { width: 96, alignItems: "center", marginBottom: spacing.lg },
  carCircle: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: colors.accentBg,
    alignItems: "center", justifyContent: "center",
  },
  badge: {
    position: "absolute", top: -2, right: 4,
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.bg,
  },
  road: {
    width: 72, height: 2, marginTop: spacing.sm, borderRadius: 1,
    borderStyle: "dashed", borderWidth: 1, borderColor: colors.border,
  },
  title: { ...typography.body, color: colors.textSecondary, textAlign: "center", fontWeight: "600" },
  subtitle: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs },
});
