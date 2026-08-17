import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";
import * as Location from "expo-location";

// Shown once, contextually right before the first trip start — not
// buried in onboarding where it's easy to deny reflexively. Only after
// the user taps "Allow" here does the actual OS permission dialog fire.
// This two-step pattern is what iOS App Store review expects for
// background location justification.
//
// Same hero-disc treatment as the onboarding carousel (see
// SplashOnboardingScreens' SlideArt) plus a short "what this is for"
// list — the old version was a bare unicode glyph in a circle with one
// paragraph of body text, which read as a generic system dialog rather
// than something worth trusting with an actual "why".
export default function LocationPermissionPrimingScreen({ navigation, route }: any) {
  useScreenView("LocationPermissionPrimingScreen");
  const { t } = useTranslation();
  const { onContinue } = route.params || {};
  const [requesting, setRequesting] = useState(false);

  const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
    { icon: "navigate-circle", text: t("locationPermission.benefit1") },
    { icon: "alert-circle", text: t("locationPermission.benefit2") },
    { icon: "eye-off", text: t("locationPermission.benefit3") },
  ];

  async function handleAllow() {
    setRequesting(true);
    try {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (foreground.status === "granted") {
        // Background permission is a separate prompt on iOS — only ask
        // once foreground is already granted.
        await Location.requestBackgroundPermissionsAsync();
      }
      onContinue?.({ granted: foreground.status === "granted" });
      navigation.goBack();
    } finally {
      setRequesting(false);
    }
  }

  function handleSkip() {
    // Graceful degraded mode: trip flow still works with foreground-only
    // location, live tracking just won't update while the app is
    // backgrounded. Never block the flow entirely.
    onContinue?.({ granted: false });
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.body}>
        <View style={styles.artWrap}>
          <View style={[styles.artDot, { top: 8, left: 22, width: 14, height: 14 }]} />
          <View style={[styles.artDot, { top: 30, right: 6, width: 10, height: 10, backgroundColor: colors.accent, opacity: 0.35 }]} />
          <View style={[styles.artDot, { bottom: 16, left: 2, width: 18, height: 18 }]} />
          <View style={styles.artDisc}>
            <View style={styles.artInnerDisc}>
              <Ionicons name="location" size={48} color={colors.accentText} />
            </View>
          </View>
        </View>

        <Text style={styles.title}>{t("locationPermission.title")}</Text>
        <Text style={styles.description}>{t("locationPermission.description")}</Text>

        <View style={styles.benefitsList}>
          {BENEFITS.map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              <View style={styles.benefitIconWrap}>
                <Ionicons name={b.icon} size={16} color={colors.accentText} />
              </View>
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.allowButton} onPress={handleAllow} disabled={requesting}>
          <Text style={styles.allowButtonText}>{requesting ? t("locationPermission.requesting") : t("locationPermission.title")}</Text>
        </Pressable>
        <Pressable style={styles.skipButton} onPress={handleSkip} hitSlop={8}>
          <Text style={styles.skipButtonText}>{t("locationPermission.notNow")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: "center" },
  body: { padding: spacing.xl, alignItems: "center" },
  artWrap: { width: 156, height: 156, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  artDisc: { width: 128, height: 128, borderRadius: 64, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  artInnerDisc: { width: 88, height: 88, borderRadius: 44, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  artDot: { position: "absolute", borderRadius: 999, backgroundColor: colors.accentBg },
  title: { ...typography.title, fontSize: 20, textAlign: "center" },
  description: { ...typography.body, fontSize: 14, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, lineHeight: 21 },
  benefitsList: { alignSelf: "stretch", marginTop: spacing.lg, gap: spacing.sm },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  benefitIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  benefitText: { ...typography.caption, color: colors.textPrimary, flex: 1 },
  allowButton: { backgroundColor: colors.accent, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginTop: spacing.xl, alignSelf: "stretch" },
  allowButtonText: { ...typography.body, fontSize: 15, color: "#FFFFFF", fontWeight: "700", fontFamily: FONT.bold },
  skipButton: { marginTop: spacing.md, padding: spacing.xs },
  skipButtonText: { ...typography.caption, color: colors.textMuted, fontWeight: "600", fontFamily: FONT.medium },
});
