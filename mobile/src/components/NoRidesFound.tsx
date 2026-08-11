import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { colors, spacing, typography, FONT } from "../theme/theme";

// Same empty-fuel-gauge illustration as EmptyState, just sized up —
// this is the single highest-traffic empty state (search results), so
// it keeps its own slightly bigger, more prominent treatment while
// staying visually consistent with every other "nothing here" screen.
export function NoRidesFound({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.container}>
      <Image source={require("../../assets/nodata.gif")} style={styles.image} resizeMode="contain" />
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  image: { width: 224, height: 153 },
  title: { ...typography.body, color: colors.textSecondary, textAlign: "center", fontWeight: "700", fontFamily: FONT.bold, marginTop: spacing.md },
  subtitle: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs },
});
