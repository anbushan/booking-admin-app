import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme/theme";

const SIZES = {
  sm: { track: 64, car: 18, shadow: 14 },
  md: { track: 110, car: 26, shadow: 20 },
  lg: { track: 160, car: 34, shadow: 26 },
};

// The app's own loading indicator — a little illustrated scene (car
// driving back and forth over a dashed road, with a ground shadow and
// trailing motion lines that hint movement) rather than the plain
// native ActivityIndicator spinner, shown on every full-page load.
// Pure Animated (no reanimated/lottie), so it needs nothing beyond
// what's already in the app. `label`, when given, sits under the scene
// — every existing call site omits it and is unaffected.
export function CarLoader({ size = "md", label }: { size?: "sm" | "md" | "lg"; label?: string }) {
  const { track, car, shadow } = SIZES[size];
  const progress = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const drive = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    const wheelBounce = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 140, useNativeDriver: true }),
      ])
    );
    drive.start();
    wheelBounce.start();
    return () => { drive.stop(); wheelBounce.stop(); };
  }, []);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, track - car] });
  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] });
  // Motion lines and shadow both read as "in transit" only while the
  // car is mid-road — faded at either end, where it's essentially
  // parked for a beat before turning around.
  const midOpacity = progress.interpolate({ inputRange: [0, 0.15, 0.5, 0.85, 1], outputRange: [0.15, 0.8, 0.8, 0.8, 0.15] });
  const shadowScale = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] });

  return (
    <View style={styles.wrap}>
      <View style={[styles.scene, { width: track }]}>
        <Animated.View style={[styles.motionLines, { opacity: midOpacity }]}>
          <View style={[styles.motionLine, { width: car * 0.6 }]} />
          <View style={[styles.motionLine, { width: car * 0.4 }]} />
        </Animated.View>
        <Animated.View style={{ transform: [{ translateX }, { translateY }] }}>
          <Ionicons name="car-sport" size={car} color={colors.accent} />
        </Animated.View>
        <Animated.View
          style={[
            styles.shadow,
            { width: shadow, height: shadow * 0.32, borderRadius: shadow, opacity: midOpacity, transform: [{ translateX }, { scaleX: shadowScale }] },
          ]}
        />
        <View style={styles.road} />
      </View>
      {!!label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  scene: { alignItems: "flex-start" },
  motionLines: { position: "absolute", left: -14, top: "50%", marginTop: -6, gap: 3 },
  motionLine: { height: 2, borderRadius: 1, backgroundColor: colors.border },
  shadow: { backgroundColor: colors.border, marginTop: -2 },
  road: {
    height: 2,
    width: "100%",
    marginTop: 4,
    borderRadius: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
});
