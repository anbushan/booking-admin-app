import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../theme/theme";

export function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>{"!"}</Text>
      </View>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Try again</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", padding: spacing.xl, marginTop: spacing.xl },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.dangerBg, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  icon: { fontSize: 20, fontWeight: "700", color: colors.danger },
  message: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  retryButton: { marginTop: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryButtonText: { ...typography.caption, color: colors.accentText, fontWeight: "500" },
});
