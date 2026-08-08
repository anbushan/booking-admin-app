import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme/theme";

// A small illustrated scene — icon in a circle over a dashed "empty
// road" — rather than a bare icon, so every "nothing here yet" screen
// in the app (notifications, vehicles, payment history, ratings...)
// reads as a considered empty state, not a placeholder. Same prop
// surface as before this pass, so every existing call site picked this
// up automatically; NoRidesFound stays as the more elaborate,
// search-specific variant for the single highest-traffic empty state.
export function EmptyState({
  title,
  subtitle,
  icon = "file-tray-outline",
}: {
  title: string;
  subtitle?: string;
  icon?: string;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.scene}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon as any} size={26} color={colors.accentText} />
        </View>
        <View style={styles.road} />
      </View>
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
  scene: { alignItems: "center", marginBottom: spacing.md },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  road: { width: 56, height: 2, marginTop: spacing.sm, borderRadius: 1, borderStyle: "dashed", borderWidth: 1, borderColor: colors.border },
  title: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  subtitle: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs },
});
