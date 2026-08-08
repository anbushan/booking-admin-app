import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
        <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
      </View>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Ionicons name="refresh-outline" size={14} color={colors.accentText} />
          <Text style={styles.retryButtonText}>Try again</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", padding: spacing.xl, marginTop: spacing.xl },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.dangerBg, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  message: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  retryButton: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryButtonText: { ...typography.caption, color: colors.accentText, fontWeight: "500" },
});
