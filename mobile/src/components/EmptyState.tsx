import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme/theme";
import { EmptyGauge } from "./EmptyGauge";

// One consistent "no data" illustration for every empty state in the
// app (notifications, vehicles, payment history, ratings...) — an
// empty fuel gauge, needle on E, in place of the assortment of
// per-screen icons this used to show. `icon` is accepted for backward
// compatibility with existing call sites but no longer drives what's
// drawn — every empty state now reads as the same "nothing here yet"
// moment instead of a different icon per screen.
export function EmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
}) {
  return (
    <View style={styles.container}>
      <EmptyGauge />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // flex:1 + the list's own contentContainerStyle needing flexGrow:1 is
  // what actually centers this in the middle of the screen — previously
  // just a marginTop nudge, which only pushed it partway down from the
  // top of whatever space the (possibly short) list content left.
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  title: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm },
  subtitle: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs },
});
