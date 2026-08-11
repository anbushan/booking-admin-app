import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography, FONT } from "../theme/theme";

export type TrackerStep = {
  key: string;
  title: string;
  time?: string;
  state: "done" | "active" | "pending";
  icon: string;
};

// The booking journey, shared by every screen that shows "where is this
// booking right now" — passenger's My bookings, and the driver's own
// booking-requests views (same journey, seen from the other side). One
// definition so a CONFIRMED booking looks like the same step on both
// sides of the same trip.
const JOURNEY_STEPS: { key: string; titleKey: string; titleEn: string; icon: string }[] = [
  { key: "requested", titleKey: "journey.requested", titleEn: "Requested", icon: "paper-plane-outline" },
  { key: "accepted", titleKey: "journey.acceptedByDriver", titleEn: "Accepted by driver", icon: "thumbs-up-outline" },
  { key: "paid", titleKey: "journey.platformFeePaid", titleEn: "Platform fee paid", icon: "wallet-outline" },
  { key: "started", titleKey: "journey.tripStarted", titleEn: "Trip started", icon: "car-outline" },
  { key: "completed", titleKey: "status.completed", titleEn: "Completed", icon: "flag-outline" },
];
const JOURNEY_INDEX: Record<string, number> = {
  BOOKED: 0, AWAITING_PAYMENT: 1, CHARGE_ATTEMPTED: 1, PAYMENT_PENDING: 1, CONFIRMED: 2, IN_PROGRESS: 3,
};

// `t` is optional, same convention as formatSearchDate/labelForDate —
// this is called from several screens, not all of which have
// useTranslation() wired at every call site, so it falls back to
// English rather than forcing every caller to thread `t` through.
export function bookingJourneySteps(status: string, t?: (key: string) => string): TrackerStep[] {
  const activeIndex = JOURNEY_INDEX[status] ?? 0;
  return JOURNEY_STEPS.map((def, i) => {
    let titleKey = def.titleKey;
    let titleEn = def.titleEn;
    if (i === 1 && status === "CHARGE_ATTEMPTED") { titleKey = "status.paymentInProgress"; titleEn = "Payment in progress"; }
    else if (i === 1 && status === "PAYMENT_PENDING") { titleKey = "status.paymentFailedRetry"; titleEn = "Payment failed — retry"; }
    return {
      key: def.key,
      icon: def.icon,
      state: i < activeIndex ? "done" : i === activeIndex ? "active" : "pending",
      title: t ? t(titleKey) : titleEn,
    };
  });
}

// The "where is this, right now" view — a passenger's booking or a
// driver's ride read top to bottom as a line instead of a single status
// word. Used by HistoryScreen (passenger "My bookings") and
// UpcomingTripsScreen (driver) so both sides of a trip see the same
// shape of progress, not two different mental models.
export function StepTracker({ steps }: { steps: TrackerStep[] }) {
  const [rowCenters, setRowCenters] = useState<number[]>([]);
  const carY = useRef(new Animated.Value(0)).current;
  const activeIndex = steps.findIndex((s) => s.state === "active");

  function handleRowLayout(index: number, y: number, height: number) {
    setRowCenters((prev) => {
      const next = [...prev];
      next[index] = y + height / 2 - 11; // center the 22px car badge on the row's dot
      return next;
    });
  }

  useEffect(() => {
    if (activeIndex < 0 || rowCenters.length !== steps.length || rowCenters.some((y) => y == null)) return;
    // The car "drives" down from the top of the line to wherever the
    // booking actually is right now — a literal position change, not
    // just a color change, when this mounts or the active step moves.
    Animated.timing(carY, {
      toValue: rowCenters[activeIndex],
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, rowCenters.length, rowCenters[activeIndex]]);

  return (
    <View style={{ position: "relative" }}>
      {activeIndex >= 0 && rowCenters.length === steps.length && (
        <Animated.View style={[styles.carBadge, { transform: [{ translateY: carY }] }]} pointerEvents="none">
          <Ionicons name="car-sport" size={13} color="#FFFFFF" />
        </Animated.View>
      )}
      {steps.map((step, i) => (
        <View
          key={step.key}
          style={styles.row}
          onLayout={(e) => handleRowLayout(i, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
        >
          <View style={styles.rail}>
            <StepDot step={step} />
            {i < steps.length - 1 && (
              <View style={[styles.line, { backgroundColor: step.state === "done" ? colors.success : colors.border }]} />
            )}
          </View>
          <View style={[styles.body, i === steps.length - 1 && { paddingBottom: 0 }]}>
            <Text style={[typography.caption, styles.title, step.state === "pending" && { color: colors.textMuted }]}>
              {step.title}
            </Text>
            {!!step.time && <Text style={styles.time}>{step.time}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

function StepDot({ step }: { step: TrackerStep }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step.state !== "active") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [step.state]);

  if (step.state === "done") {
    return (
      <View style={[styles.dot, { backgroundColor: colors.success }]}>
        <Ionicons name="checkmark" size={13} color="#FFFFFF" />
      </View>
    );
  }
  if (step.state === "active") {
    const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
    const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
    return (
      <View style={styles.dotWrap}>
        <Animated.View style={[styles.pulseRing, { transform: [{ scale }], opacity }]} />
        {/* The dot itself stays a plain marker now that the animated car
            (above, in StepTracker) is what actually sits on the active
            row — kept as an icon-in-a-circle rather than hidden, so the
            row still reads correctly before the car's layout-dependent
            position is known (first paint) or if it's ever used without
            room for the overlay. */}
        <View style={[styles.dot, { backgroundColor: colors.accent }]}>
          <Ionicons name={step.icon as any} size={12} color="#FFFFFF" />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.dot, styles.dotPending]}>
      <Ionicons name={step.icon as any} size={12} color={colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  rail: { width: 22, alignItems: "center" },
  dotWrap: { alignItems: "center", justifyContent: "center" },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  dotPending: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border },
  pulseRing: { position: "absolute", width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent },
  carBadge: {
    position: "absolute", left: 0, top: 0, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.marigold, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.surface, zIndex: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3,
  },
  line: { width: 2, flex: 1, minHeight: 20, marginVertical: 2 },
  body: { paddingBottom: spacing.md, flex: 1 },
  title: { fontWeight: "700", fontFamily: FONT.bold },
  time: { ...typography.small, color: colors.textMuted, marginTop: 1 },
});
