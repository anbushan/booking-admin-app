import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

// Full-stop screen — no bottom nav, no back button, deliberately. There
// is nothing else to do here but wait and retry; see admin's Settings >
// App configuration for the toggle that puts the app in this state, and
// SplashOnboardingScreens.tsx for where this gets checked (once, at
// launch).
export default function MaintenanceScreen({ navigation, route }: any) {
  useScreenView("MaintenanceScreen");
  const { t } = useTranslation();
  const { message } = route.params || {};
  const [checking, setChecking] = useState(false);

  async function handleRetry() {
    setChecking(true);
    try {
      const status = await api.getAppStatus();
      if (!status.maintenanceMode) {
        navigation.replace("Splash");
      }
    } catch {
      // Still down or offline — stay put, nothing else to show.
    } finally {
      setChecking(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name="construct-outline" size={30} color={colors.accentText} />
        </View>
        <Text style={styles.title}>{t("maintenance.title")}</Text>
        <Text style={styles.subtitle}>
          {message || t("maintenance.defaultMessage")}
        </Text>
        <Pressable style={styles.button} onPress={handleRetry} disabled={checking}>
          <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
          <Text style={styles.buttonText}>{checking ? t("maintenance.checking") : t("common.tryAgain")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: spacing.lg, alignItems: "center", justifyContent: "center" },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentBg,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  title: { ...typography.title, fontSize: 19, textAlign: "center" },
  subtitle: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.xl, lineHeight: 19, maxWidth: 300 },
  button: {
    flexDirection: "row", gap: spacing.xs,
    backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm,
    alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl,
  },
  buttonText: { ...typography.title, color: "#FFFFFF" },
});
