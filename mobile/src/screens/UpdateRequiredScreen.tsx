import React from "react";
import { View, Text, StyleSheet, Linking } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

const ANDROID_PACKAGE = "com.carpool.app";
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

// Full-stop screen — same shape as MaintenanceScreen.tsx (no bottom nav,
// no back button, nothing else to do here), but "retry" doesn't make
// sense for this one: the installed APK itself is the problem, not a
// transient server state, so the only way out is the Play Store. See
// admin's Settings > App configuration for the minSupportedVersion field
// that puts the app in this state, and SplashOnboardingScreens.tsx for
// where this gets checked (once, at launch, right after maintenanceMode).
export default function UpdateRequiredScreen() {
  useScreenView("UpdateRequiredScreen");
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name="arrow-up-circle-outline" size={30} color={colors.accentText} />
        </View>
        <Text style={styles.title}>{t("updateRequired.title")}</Text>
        <Text style={styles.subtitle}>{t("updateRequired.message")}</Text>
        <Pressable style={styles.button} onPress={() => Linking.openURL(PLAY_STORE_URL)}>
          <Ionicons name="logo-google-playstore" size={16} color="#FFFFFF" />
          <Text style={styles.buttonText}>{t("updateRequired.button")}</Text>
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
