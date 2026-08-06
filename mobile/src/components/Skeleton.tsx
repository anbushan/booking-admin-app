import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet, ViewStyle } from "react-native";
import { colors, radius, spacing } from "../theme/theme";

// Single shimmering block — compose these into skeleton layouts per screen.
export function SkeletonBlock({ style }: { style?: ViewStyle }) {
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
    <View style={{ padding: spacing.md, gap: spacing.sm }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.border, borderRadius: radius.sm },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
