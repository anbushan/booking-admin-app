import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "./Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";

// Shown by Sentry.ErrorBoundary (see App.tsx) in place of a render-time
// crash — without this, that same crash was either a blank white screen
// or, in dev, RN's red error box, with the user's only recourse being to
// force-quit and hope. Deliberately not using useTranslation() here: if
// the crash happened inside I18nProvider itself (or anything it depends
// on), a fallback screen that also needs that same context to render
// could fail the exact same way, showing nothing at all instead of a
// recovery screen. Plain hardcoded English is a one-time cost on an
// already-rare path, not a real i18n gap in the app.
export function CrashFallback({ resetError }: { resetError: () => void }) {
  return (
    <View style={styles.screen}>
      <View style={styles.iconWrap}>
        <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.subtitle}>
        The app hit an unexpected error. This has been reported — tap below to try again.
      </Text>
      <Pressable style={styles.button} onPress={resetError}>
        <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.dangerBg,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  title: { ...typography.titleCompact, textAlign: "center" },
  subtitle: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.xl, maxWidth: 280, lineHeight: 18 },
  button: {
    flexDirection: "row", gap: spacing.xs,
    backgroundColor: colors.textPrimary, height: 48, borderRadius: radius.sm,
    alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl,
  },
  buttonText: { ...typography.title, color: "#FFFFFF" },
});
