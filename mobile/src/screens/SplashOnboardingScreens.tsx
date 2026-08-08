import React, { useEffect, useState, useRef } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, Dimensions, Animated, Easing } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export function SplashScreen({ navigation }: any) {
  const badgeScale = useRef(new Animated.Value(0.6)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Analytics.appOpen();

    // A brief, deliberate entrance rather than the title/tagline just
    // appearing — the badge scales up and settles in, the tagline
    // follows a beat later, then the loading dots fade in last. All
    // opacity/transform, so useNativeDriver covers the whole sequence.
    Animated.sequence([
      Animated.parallel([
        Animated.spring(badgeScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
        Animated.timing(badgeOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(dotsOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

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
      <Animated.View style={[styles.splashBadge, { opacity: badgeOpacity, transform: [{ scale: badgeScale }] }]}>
        <Ionicons name="car-sport" size={30} color="#FFFFFF" />
      </Animated.View>
      <Text style={styles.splashTitle}>Carpool</Text>
      <Animated.Text style={[styles.splashTagline, { opacity: taglineOpacity }]}>
        Share the ride, split the cost
      </Animated.Text>
      <Animated.View style={{ opacity: dotsOpacity, marginTop: spacing.xl }}>
        <LoadingDots />
      </Animated.View>
    </View>
  );
}

// Three dots pulsing in sequence — reads as "loading" without a literal
// spinner, and keeps the launch screen from feeling static while the
// permission checks and auth-state read above resolve.
function LoadingDots() {
  const values = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, { toValue: 1, duration: 350, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 350, easing: Easing.ease, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {values.map((v, i) => (
        <Animated.View key={i} style={[styles.loadingDot, { opacity: v }]} />
      ))}
    </View>
  );
}

const SLIDES = [
  { title: "Find a ride, or offer one", body: "Search rides going your way, or publish your own route and share the cost.", icon: "navigate-outline" },
  { title: "Ride with people you can trust", body: "Ratings, reviews, and driver verification keep the community safe.", icon: "shield-checkmark-outline" },
  { title: "Pay only after your trip", body: "No upfront charge — you pay once the trip is done.", icon: "wallet-outline" },
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
            <View style={styles.slideIcon}>
              <Ionicons name={item.icon as any} size={40} color={colors.accentText} />
            </View>
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
          <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  splashScreen: { flex: 1, backgroundColor: colors.textPrimary, alignItems: "center", justifyContent: "center" },
  splashBadge: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: colors.marigold,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  splashTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "500" },
  splashTagline: { color: "#FFFFFF", opacity: 0.7, fontSize: 13, marginTop: spacing.xs },
  loadingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" },
  screen: { flex: 1, backgroundColor: colors.bg },
  slide: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
  slideIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accentBg, marginBottom: spacing.xl, alignItems: "center", justifyContent: "center" },
  slideTitle: { ...typography.title, fontSize: 18, textAlign: "center" },
  slideBody: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, lineHeight: 20 },
  dots: { flexDirection: "row", justifyContent: "center", gap: spacing.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent, width: 18 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  skip: { ...typography.caption, color: colors.textMuted },
  nextButton: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.accent, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.sm },
  nextButtonText: { color: "#FFFFFF", ...typography.caption, fontWeight: "500" },
});
