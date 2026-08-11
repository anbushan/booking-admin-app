import React, { useEffect, useState, useRef } from "react";
import { View, Text, Image, StyleSheet, FlatList, Dimensions, Animated } from "react-native";
import { Pressable } from "../components/Pressable";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { Analytics } from "../lib/analytics";
import { api } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

const { width } = Dimensions.get("window");

export function SplashScreen({ navigation }: any) {
  useScreenView("SplashScreen");
  const badgeScale = useRef(new Animated.Value(0.6)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Analytics.appOpen();

    // A brief, deliberate entrance rather than the title/tagline just
    // appearing — the badge scales up and settles in, then the tagline
    // follows a beat later. All opacity/transform, so useNativeDriver
    // covers the whole sequence.
    Animated.sequence([
      Animated.parallel([
        Animated.spring(badgeScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
        Animated.timing(badgeOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
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
      // Checked before anything else — a maintenance-mode toggle in
      // admin should block every launch, signed in or not, not just
      // fresh signups. Network failure here (offline, backend down)
      // deliberately falls through to normal routing rather than
      // stranding someone on a maintenance screen that can't even
      // confirm maintenance is real.
      try {
        const status = await api.getAppStatus();
        if (status.maintenanceMode) {
          navigation.replace("Maintenance", { message: status.maintenanceMessage });
          return;
        }
      } catch {
        // fall through
      }

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
        <Image source={require("../../assets/brand-mark.png")} style={styles.splashBadgeImage} resizeMode="contain" />
      </Animated.View>
      <Text style={styles.splashTitle}>NanbaGO</Text>
      <Animated.Text style={[styles.splashTagline, { opacity: taglineOpacity }]}>
        Dosti For Every Journey.
      </Animated.Text>
    </View>
  );
}

const SLIDE_KEYS = [
  { titleKey: "onboarding.slide1Title", bodyKey: "onboarding.slide1Body", icon: "navigate-outline" },
  { titleKey: "onboarding.slide2Title", bodyKey: "onboarding.slide2Body", icon: "shield-checkmark-outline" },
  { titleKey: "onboarding.slide3Title", bodyKey: "onboarding.slide3Body", icon: "wallet-outline" },
] as const;

export function OnboardingScreen({ navigation }: any) {
  useScreenView("OnboardingScreen");
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const SLIDES = SLIDE_KEYS.map((s) => ({ title: t(s.titleKey), body: t(s.bodyKey), icon: s.icon }));

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
          <Text style={styles.skip}>{t("onboarding.skip")}</Text>
        </Pressable>
        <Pressable style={styles.nextButton} onPress={next}>
          <Text style={styles.nextButtonText}>{index === SLIDES.length - 1 ? t("onboarding.getStarted") : t("onboarding.next")}</Text>
          <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  splashScreen: { flex: 1, backgroundColor: colors.textPrimary, alignItems: "center", justifyContent: "center" },
  splashBadge: {
    // White backdrop, not a colored fill — the real mark already carries
    // its own blue/orange/navy/green, a solid color circle behind it
    // would fight the actual brand colors instead of framing them.
    width: 84, height: 84, borderRadius: 20, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
    padding: 10,
  },
  splashBadgeImage: { width: "100%", height: "100%" },
  splashTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "700", fontFamily: FONT.bold },
  splashTagline: { color: "#FFFFFF", opacity: 0.7, fontSize: 13, marginTop: spacing.xs },
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
  nextButtonText: { ...typography.caption, color: "#FFFFFF", fontWeight: "700", fontFamily: FONT.bold },
});
