import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import * as Location from "expo-location";
import { colors, spacing, radius, typography } from "../theme/theme";
import { SafeAreaView } from "react-native-safe-area-context";

// Shown once, contextually right before the first trip start — not
// buried in onboarding where it's easy to deny reflexively. Only after
// the user taps "Allow" here does the actual OS permission dialog fire.
// This two-step pattern is what iOS App Store review expects for
// background location justification.
export default function LocationPermissionPrimingScreen({ navigation, route }: any) {
  const { onContinue } = route.params || {};
  const [requesting, setRequesting] = useState(false);

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
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>{"\u25CE"}</Text>
        </View>
        <Text style={styles.title}>Allow location access</Text>
        <Text style={styles.description}>
          We use your location during an active trip so the other rider
          can track progress and to power the SOS button if you ever
          need help. Location isn't tracked outside of active trips.
        </Text>
        <Pressable style={styles.allowButton} onPress={handleAllow} disabled={requesting}>
          <Text style={styles.allowButtonText}>{requesting ? "Requesting..." : "Allow location access"}</Text>
        </Pressable>
        <Pressable style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Not now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: "center" },
  body: { padding: spacing.xl, alignItems: "center" },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  iconText: { fontSize: 28, color: colors.accentText },
  title: { ...typography.title, fontSize: 18, textAlign: "center" },
  description: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, lineHeight: 20 },
  allowButton: { backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.xl, alignSelf: "stretch" },
  allowButtonText: { color: "#FFFFFF", ...typography.title },
  skipButton: { marginTop: spacing.md },
  skipButtonText: { ...typography.caption, color: colors.textMuted },
});
