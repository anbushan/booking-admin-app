import React, { useEffect, useRef, useState } from "react";
import { View, Text, Modal, ScrollView, Animated, Easing, StyleSheet } from "react-native";
import { Pressable } from "./Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { useTranslation } from "../lib/i18n/I18nContext";

type Step = { icon: keyof typeof Ionicons.glyphMap; titleKey: string; descKey: string };

// A plain, static walkthrough of the whole flow — not tied to any one
// booking (that's StepTracker's job) — so someone new to the app has a
// mental model of what happens end to end before they've done it once.
export const DRIVER_STEPS: Step[] = [
  { icon: "add-circle-outline", titleKey: "howItWorks.driver.step1Title", descKey: "howItWorks.driver.step1Desc" },
  { icon: "mail-unread-outline", titleKey: "howItWorks.driver.step2Title", descKey: "howItWorks.driver.step2Desc" },
  { icon: "wallet-outline", titleKey: "howItWorks.driver.step3Title", descKey: "howItWorks.driver.step3Desc" },
  { icon: "car-outline", titleKey: "howItWorks.driver.step4Title", descKey: "howItWorks.driver.step4Desc" },
  { icon: "cash-outline", titleKey: "howItWorks.driver.step5Title", descKey: "howItWorks.driver.step5Desc" },
];

export const PASSENGER_STEPS: Step[] = [
  { icon: "search-outline", titleKey: "howItWorks.passenger.step1Title", descKey: "howItWorks.passenger.step1Desc" },
  { icon: "paper-plane-outline", titleKey: "howItWorks.passenger.step2Title", descKey: "howItWorks.passenger.step2Desc" },
  { icon: "wallet-outline", titleKey: "howItWorks.passenger.step3Title", descKey: "howItWorks.passenger.step3Desc" },
  { icon: "key-outline", titleKey: "howItWorks.passenger.step4Title", descKey: "howItWorks.passenger.step4Desc" },
  { icon: "star-outline", titleKey: "howItWorks.passenger.step5Title", descKey: "howItWorks.passenger.step5Desc" },
];

// Off-screen starting offset for the slide-up — bigger than any
// realistic sheet height so it's always fully hidden at rest,
// regardless of how much content the step list ends up being.
const OFFSCREEN_Y = 700;

type Props = {
  visible: boolean;
  role: "DRIVER" | "PASSENGER" | undefined;
  onClose: () => void;
};

export function HowItWorksSheet({ visible, role, onClose }: Props) {
  const { t } = useTranslation();
  const steps = role === "DRIVER" ? DRIVER_STEPS : PASSENGER_STEPS;

  // Hand-rolled slide-up rather than Modal's own `animationType="slide"`
  // — RN's built-in modal transition is a fixed, non-interruptible
  // animation with no easing control, which is exactly what reads as
  // "not that smooth" next to a custom-eased one. Same technique as
  // SideMenu's slide-in: stay mounted through the close animation
  // (`mounted` state) instead of letting `visible` unmount it instantly.
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(OFFSCREEN_Y)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(OFFSCREEN_Y);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: OFFSCREEN_Y, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} noFeedback />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t("howItWorks.title")}</Text>
          <Pressable style={styles.closeButton} onPress={onClose} hitSlop={6}>
            <Ionicons name="close" size={17} color={colors.textPrimary} />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          {role === "DRIVER" ? t("howItWorks.driverSubtitle") : t("howItWorks.passengerSubtitle")}
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: spacing.md }}>
          {steps.map((step, i) => (
            <View key={step.titleKey} style={styles.stepRow}>
              <View style={styles.rail}>
                <View style={styles.iconWrap}>
                  <Ionicons name={step.icon} size={16} color={colors.accentText} />
                </View>
                {i < steps.length - 1 && <View style={styles.line} />}
              </View>
              <View style={[styles.stepBody, i === steps.length - 1 && { paddingBottom: 0 }]}>
                <Text style={styles.stepTitle}>{t(step.titleKey)}</Text>
                <Text style={styles.stepDescription}>{t(step.descKey)}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <Pressable style={styles.gotItButton} onPress={onClose}>
          <Text style={styles.gotItText}>{t("howItWorks.gotIt")}</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(22,33,58,0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: "80%",
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...typography.title, fontSize: 17 },
  closeButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  stepRow: { flexDirection: "row", gap: spacing.sm },
  rail: { width: 32, alignItems: "center" },
  iconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  line: { width: 2, flex: 1, minHeight: 20, backgroundColor: colors.border, marginVertical: 2 },
  stepBody: { flex: 1, paddingBottom: spacing.md },
  stepTitle: { ...typography.body, fontWeight: "700" },
  stepDescription: { ...typography.small, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  gotItButton: { backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  gotItText: { ...typography.title, color: "#FFFFFF" },
});
