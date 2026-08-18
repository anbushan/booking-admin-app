import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { colors, radius, spacing } from "../theme/theme";

// Single shimmering block — compose these into skeleton layouts per screen.
// StyleProp (not a bare ViewStyle) so callers can pass an array — e.g.
// `[styles.someBase, { width: "45%" }]`, the normal RN way to layer a
// one-off override onto a shared base style — the same flexibility a
// plain View's own style prop already has.
export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return <Animated.View style={[styles.block, style, { opacity }]} />;
}

// Preset: a single list-row skeleton (avatar + two lines + trailing value),
// matching the shape most cards in this app use — search results, history,
// booking requests, chat list, notifications, etc.
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <SkeletonBlock style={{ width: "60%", height: 14, marginBottom: spacing.xs }} />
        <SkeletonBlock style={{ width: "40%", height: 11 }} />
      </View>
      <SkeletonBlock style={{ width: 50, height: 16 }} />
    </View>
  );
}

// Preset: a short list of row skeletons, drop-in replacement for a
// loading FlatList.
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    // flex: 1 is the important part here, not cosmetic — this replaces a
    // FlatList that itself has style={{flex:1}}, filling the space
    // between the screen's header and its bottom nav/tab bar. Without
    // it, this shorter, intrinsic-height block leaves that space empty
    // during loading, so anything pinned below (AppBottomNav) renders
    // too high and visibly jumps down the moment real content swaps in.
    <View style={{ flex: 1, padding: spacing.md, gap: spacing.sm }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

// Preset: a leading circular avatar + two text lines — matches the
// chat/notification/vehicle/upcoming-trip row shape, which SkeletonRow
// alone doesn't cover (no avatar).
export function SkeletonAvatarRow() {
  return (
    <View style={styles.row}>
      <SkeletonBlock style={styles.avatar} />
      <View style={{ flex: 1 }}>
        <SkeletonBlock style={{ width: "55%", height: 14, marginBottom: spacing.xs }} />
        <SkeletonBlock style={{ width: "35%", height: 11 }} />
      </View>
    </View>
  );
}

export function SkeletonAvatarRowList({ count = 4 }: { count?: number }) {
  return (
    // Same flex: 1 reasoning as SkeletonList above.
    <View style={{ flex: 1, padding: spacing.md, gap: spacing.sm }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonAvatarRow key={i} />
      ))}
    </View>
  );
}

// Preset: a multi-line "trip card" — route line, a meta line, a chip,
// and a trailing action-button placeholder. Matches History,
// BookingRequests, PaymentQueue, UpcomingTrips, ManageRecurringRides.
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <SkeletonBlock style={{ width: "80%", height: 15, marginBottom: spacing.xs }} />
      <SkeletonBlock style={{ width: "45%", height: 11, marginBottom: spacing.sm }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <SkeletonBlock style={{ width: 70, height: 20, borderRadius: 999 }} />
        <SkeletonBlock style={{ width: 90, height: 32 }} />
      </View>
    </View>
  );
}

export function SkeletonCardList({ count = 3 }: { count?: number }) {
  return (
    // Same flex: 1 reasoning as SkeletonList above.
    <View style={{ flex: 1, padding: spacing.md, gap: spacing.sm }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

// Preset: the thin section-header bar SectionList screens (Notifications
// grouped by day, BookingRequests/PaymentQueue/UpcomingTrips grouped by
// ride) render above each group.
export function SkeletonSectionHeader() {
  return <SkeletonBlock style={{ width: "30%", height: 12, marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.xs }} />;
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.border, borderRadius: radius.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
