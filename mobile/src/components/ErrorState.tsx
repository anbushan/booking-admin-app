import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "./Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { useTranslation } from "../lib/i18n/I18nContext";

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
      </View>
      <Text style={styles.message}>{message || t("common.somethingWrong")}</Text>
      {onRetry && (
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Ionicons name="refresh-outline" size={14} color={colors.accentText} />
          <Text style={styles.retryButtonText}>{t("common.tryAgain")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // flex:1 matters here, not just cosmetic — this renders as a direct
  // sibling swap for the FlatList/SectionList it replaces on error
  // (see hub screens: `{error ? <ErrorState/> : <FlatList/>}`). Without
  // it, this collapses to its own small content height instead of
  // filling the screen, and whatever's below it (AppBottomNav) jumps up
  // to sit right underneath instead of staying pinned to the bottom.
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, marginTop: spacing.xl },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.dangerBg, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  message: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  retryButton: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryButtonText: { ...typography.caption, color: colors.accentText, fontWeight: "700" },
});
