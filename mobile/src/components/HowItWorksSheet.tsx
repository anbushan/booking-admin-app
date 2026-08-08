import React from "react";
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";

type Step = { icon: keyof typeof Ionicons.glyphMap; title: string; description: string };

// A plain, static walkthrough of the whole flow — not tied to any one
// booking (that's StepTracker's job) — so someone new to the app has a
// mental model of what happens end to end before they've done it once.
export const DRIVER_STEPS: Step[] = [
  { icon: "add-circle-outline", title: "Offer a ride", description: "Publish your route, seats, and price per seat." },
  { icon: "mail-unread-outline", title: "Get requests", description: "Passengers request to book — accept or decline each one." },
  { icon: "wallet-outline", title: "Passenger pays the platform fee", description: "Confirms the seat. This part goes to the app, not to you." },
  { icon: "car-outline", title: "Start the trip", description: "Meet at pickup, verify their code, and start driving." },
  { icon: "cash-outline", title: "Collect the fare", description: "The rest is paid to you directly — cash or UPI." },
];

export const PASSENGER_STEPS: Step[] = [
  { icon: "search-outline", title: "Search a ride", description: "Enter where you're going and when." },
  { icon: "paper-plane-outline", title: "Request to book", description: "Pick a ride and send the driver a request." },
  { icon: "wallet-outline", title: "Pay the platform fee", description: "Confirms your seat once the driver accepts." },
  { icon: "key-outline", title: "Get your pickup code", description: "Share it with the driver when they arrive." },
  { icon: "star-outline", title: "Ride & rate", description: "Pay the rest directly, then rate your driver." },
];

type Props = {
  visible: boolean;
  role: "DRIVER" | "PASSENGER" | undefined;
  onClose: () => void;
};

export function HowItWorksSheet({ visible, role, onClose }: Props) {
  const steps = role === "DRIVER" ? DRIVER_STEPS : PASSENGER_STEPS;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>How it works</Text>
            <Pressable style={styles.closeButton} onPress={onClose} hitSlop={6}>
              <Ionicons name="close" size={17} color={colors.textPrimary} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            {role === "DRIVER" ? "From publishing a ride to getting paid." : "From searching a ride to rating your driver."}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: spacing.md }}>
            {steps.map((step, i) => (
              <View key={step.title} style={styles.stepRow}>
                <View style={styles.rail}>
                  <View style={styles.iconWrap}>
                    <Ionicons name={step.icon} size={16} color={colors.accentText} />
                  </View>
                  {i < steps.length - 1 && <View style={styles.line} />}
                </View>
                <View style={[styles.stepBody, i === steps.length - 1 && { paddingBottom: 0 }]}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <Pressable style={styles.gotItButton} onPress={onClose}>
            <Text style={styles.gotItText}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(22,33,58,0.45)", justifyContent: "flex-end" },
  sheet: {
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
  stepTitle: { ...typography.body, fontWeight: "600" },
  stepDescription: { ...typography.small, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  gotItButton: { backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  gotItText: { color: "#FFFFFF", ...typography.title },
});
