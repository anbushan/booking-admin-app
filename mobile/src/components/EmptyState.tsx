import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme/theme";

export function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>{"\u25CB"}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", padding: spacing.xl, marginTop: spacing.xl },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  icon: { fontSize: 20, color: colors.accentText },
  title: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  subtitle: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs },
});
