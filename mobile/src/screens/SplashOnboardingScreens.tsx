import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, FlatList, Dimensions, Animated, Easing } from "react-native";
import { Pressable } from "../components/Pressable";
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
  const carOpacity = useRef(new Animated.Value(0)).current;

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
      Animated.timing(carOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
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
      <Text style={styles.splashTitle}>NanbaGO</Text>
      <Animated.Text style={[styles.splashTagline, { opacity: taglineOpacity }]}>
        Dosti For Every Journey.
      </Animated.Text>
      <Animated.View style={{ opacity: carOpacity, marginTop: spacing.xl }}>
        <LoadingCar />
      </Animated.View>
    </View>
  );
}

const CAR_TRACK_WIDTH = 120;

// A small car icon sliding slowly side to side along a fixed track —
// reads as "loading" while staying on-brand (the same car motif as the
// badge above it), in place of the earlier generic pulsing dots.
// Slow (1.6s each direction) and eased in/out so it drifts rather than
// darts, matching the calm, deliberate pace of the rest of the splash
// entrance animation.
function LoadingCar() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const drive = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    drive.start();
    return () => drive.stop();
  }, []);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, CAR_TRACK_WIDTH - 22] });

  return (
    <View style={styles.carTrack}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        <Ionicons name="car-sport" size={22} color={colors.marigold} />
      </Animated.View>
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
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
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
  splashTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "700" },
  splashTagline: { color: "#FFFFFF", opacity: 0.7, fontSize: 13, marginTop: spacing.xs },
  carTrack: { width: CAR_TRACK_WIDTH, alignItems: "flex-start" },
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
  nextButtonText: { ...typography.caption, color: "#FFFFFF", fontWeight: "700" },
});
