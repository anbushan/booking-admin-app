import React, { useEffect, useState, useRef } from "react";
import { View, Text, Image, StyleSheet, FlatList, useWindowDimensions, Animated } from "react-native";
import { Pressable } from "../components/Pressable";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography, FONT } from "../theme/theme";
import { Analytics } from "../lib/analytics";
import { api } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";


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
        // First launch, ever — language wasn't reachable at all until
        // Settings, deep past onboarding/phone entry/OTP, all of which
        // default to English with no device-locale detection. The
        // onboarding carousel's own slides already call t() (see below),
        // so picking a language here means the carousel itself shows up
        // correctly localized too, not just phone entry/OTP — same
        // implementation cost as gating after the carousel, strictly
        // more benefit. Skipping keeps today's default (English)
        // unchanged.
        navigation.replace("LanguageSelection", { onboardingEntry: true });
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

// Each slide gets its own tone (same 3 semantic colors the rest of the
// app already has tokens for — accent/marigold/success) rather than one
// repeated blue circle for all three — Zomato/Rapido-style onboarding
// leans on color to make each slide feel like its own moment, not a
// palette swap for its own sake: blue reads "find/go", green reads
// "trust/verified", orange reads "money/value" — matching what each
// slide is actually about.
const SLIDE_KEYS = [
  { titleKey: "onboarding.slide1Title", bodyKey: "onboarding.slide1Body", icon: "navigate", tone: "accent" },
  { titleKey: "onboarding.slide2Title", bodyKey: "onboarding.slide2Body", icon: "shield-checkmark", tone: "success" },
  { titleKey: "onboarding.slide3Title", bodyKey: "onboarding.slide3Body", icon: "wallet", tone: "marigold" },
] as const;

const TONES = {
  accent: { bg: colors.accentBg, fg: colors.accentText, solid: colors.accent },
  success: { bg: colors.successBg, fg: colors.success, solid: colors.success },
  marigold: { bg: colors.marigoldBg, fg: colors.marigoldText, solid: colors.marigold },
};

// A ring of small offset dots around the main icon disc — the closest a
// pure-vector treatment gets to Zomato's illustrated onboarding blobs
// without shipping actual artwork (no illustration assets exist in this
// app yet; adding one would mean a design pass of its own). Fixed
// per-dot offsets rather than a loop of identical rings, so it reads as
// a deliberate scatter, not a mechanical pattern.
function SlideArt({ icon, tone }: { icon: string; tone: keyof typeof TONES }) {
  const t = TONES[tone];
  return (
    <View style={styles.artWrap}>
      <View style={[styles.artDot, { top: 6, left: 18, width: 14, height: 14, backgroundColor: t.bg }]} />
      <View style={[styles.artDot, { top: 28, right: 4, width: 10, height: 10, backgroundColor: t.solid, opacity: 0.35 }]} />
      <View style={[styles.artDot, { bottom: 14, left: 0, width: 18, height: 18, backgroundColor: t.bg }]} />
      <View style={[styles.artDot, { bottom: 0, right: 22, width: 12, height: 12, backgroundColor: t.solid, opacity: 0.25 }]} />
      <View style={[styles.artDisc, { backgroundColor: t.bg }]}>
        <View style={[styles.artInnerDisc, { backgroundColor: "#FFFFFF" }]}>
          <Ionicons name={icon as any} size={52} color={t.fg} />
        </View>
      </View>
    </View>
  );
}

export function OnboardingScreen({ navigation }: any) {
  useScreenView("OnboardingScreen");
  const { t } = useTranslation();
  // Reactive, not a module-scope Dimensions.get("window") snapshot taken
  // once at import time — that would keep using whatever width the app
  // happened to launch at, never picking up a split-screen/foldable
  // resize while this screen is mounted.
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const SLIDES = SLIDE_KEYS.map((s) => ({ title: t(s.titleKey), body: t(s.bodyKey), icon: s.icon, tone: s.tone }));
  const activeTone = TONES[SLIDES[index].tone];

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
      <View style={styles.skipRow}>
        <Pressable onPress={finish} hitSlop={8}>
          <Text style={styles.skip}>{t("onboarding.skip")}</Text>
        </Pressable>
      </View>

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
            <SlideArt icon={item.icon} tone={item.tone} />
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideBody}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === index && [styles.dotActive, { backgroundColor: activeTone.solid }],
            ]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Pressable style={[styles.nextButton, { backgroundColor: activeTone.solid }]} onPress={next}>
          <Text style={styles.nextButtonText}>{index === SLIDES.length - 1 ? t("onboarding.getStarted") : t("onboarding.next")}</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
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
  skipRow: { alignItems: "flex-end", paddingHorizontal: spacing.lg, paddingTop: spacing.xs, height: 40 },
  skip: { ...typography.caption, color: colors.textMuted, fontWeight: "600", fontFamily: FONT.medium },
  slide: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
  artWrap: { width: 176, height: 176, alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  artDisc: { width: 144, height: 144, borderRadius: 72, alignItems: "center", justifyContent: "center" },
  artInnerDisc: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  artDot: { position: "absolute", borderRadius: 999 },
  slideTitle: { ...typography.title, fontSize: 21, textAlign: "center" },
  slideBody: { ...typography.body, fontSize: 14, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, lineHeight: 21, maxWidth: 300 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 22 },
  footer: { padding: spacing.lg, paddingTop: spacing.xl },
  nextButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, height: 52, borderRadius: 26 },
  nextButtonText: { ...typography.body, fontSize: 15, color: "#FFFFFF", fontWeight: "700", fontFamily: FONT.bold },
});
