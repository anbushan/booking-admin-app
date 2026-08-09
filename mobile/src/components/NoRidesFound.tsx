import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme/theme";
import { EmptyGauge } from "./EmptyGauge";

// Same empty-fuel-gauge illustration as EmptyState, just sized up —
// this is the single highest-traffic empty state (search results), so
// it keeps its own slightly bigger, more prominent treatment while
// staying visually consistent with every other "nothing here" screen.
export function NoRidesFound({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.container}>
      <EmptyGauge size={140} />
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  title: { ...typography.body, color: colors.textSecondary, textAlign: "center", fontWeight: "700", marginTop: spacing.md },
  subtitle: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs },
});
