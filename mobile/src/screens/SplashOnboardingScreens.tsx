import React, { useEffect, useState, useRef } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { colors, spacing, radius, typography } from "../theme/theme";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export function SplashScreen({ navigation }: any) {
  useEffect(() => {
    Analytics.appOpen();

    // Ask for notification + location permission on every app start where
    // the answer isn't decided yet — not only once during onboarding.
    // Onboarding itself only ever runs once (skipped on every later
    // launch once "seenOnboarding" is set — on web that's localStorage,
    // which persists across reloads within the same browser), so gating
    // the ask there alone meant it would only ever fire a single time per
    // browser/install. Calling these when permission is already granted
    // or denied is a harmless no-op — no dialog shown either way.
    Notifications.getPermissionsAsync()
      .then((p) => { if (p.status === "undetermined") Notifications.requestPermissionsAsync().catch(() => {}); })
      .catch(() => {});
    Location.getForegroundPermissionsAsync()
      .then((p) => { if (p.status === "undetermined") Location.requestForegroundPermissionsAsync().catch(() => {}); })
      .catch(() => {});

    const timer = setTimeout(async () => {
      const seenOnboarding = await AsyncStorage.getItem("seenOnboarding");
      const token = await AsyncStorage.getItem("authToken");

      if (token) {
        navigation.replace("Home");
      } else if (seenOnboarding) {
        navigation.replace("PhoneEntry");
      } else {
        navigation.replace("Onboarding");
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.splashScreen}>
      <Text style={styles.splashTitle}>Carpool</Text>
      <Text style={styles.splashTagline}>Share the ride, split the cost</Text>
    </View>
  );
}

const SLIDES = [
  { title: "Find a ride, or offer one", body: "Search rides going your way, or publish your own route and share the cost." },
  { title: "Ride with people you can trust", body: "Ratings, reviews, and driver verification keep the community safe." },
  { title: "Pay only after your trip", body: "No upfront charge — you pay once the trip is done." },
];

export function OnboardingScreen({ navigation }: any) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  async function finish() {
    await AsyncStorage.setItem("seenOnboarding", "true");
    // Permission prompts now live in SplashScreen (runs on every app
    // start, not just this one-time screen) — see the comment there.
    navigation.replace("PhoneEntry");
  }

  function next() {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1 });
      setIndex(index + 1);
    } else {
      finish();
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.slideIcon} />
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideBody}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        <Pressable onPress={finish}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
        <Pressable style={styles.nextButton} onPress={next}>
          <Text style={styles.nextButtonText}>{index === SLIDES.length - 1 ? "Get started" : "Next"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  splashScreen: { flex: 1, backgroundColor: colors.textPrimary, alignItems: "center", justifyContent: "center" },
  splashTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "500" },
  splashTagline: { color: "#FFFFFF", opacity: 0.7, fontSize: 13, marginTop: spacing.xs },
  screen: { flex: 1, backgroundColor: colors.bg },
  slide: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
  slideIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accentBg, marginBottom: spacing.xl },
  slideTitle: { ...typography.title, fontSize: 18, textAlign: "center" },
  slideBody: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, lineHeight: 20 },
  dots: { flexDirection: "row", justifyContent: "center", gap: spacing.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent, width: 18 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  skip: { ...typography.caption, color: colors.textMuted },
  nextButton: { backgroundColor: colors.textPrimary, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.sm },
  nextButtonText: { color: "#FFFFFF", ...typography.caption, fontWeight: "500" },
});
