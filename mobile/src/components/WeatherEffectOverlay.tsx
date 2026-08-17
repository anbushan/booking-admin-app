import React, { useEffect, useRef, useState } from "react";
import { View, Animated, StyleSheet, LayoutChangeEvent } from "react-native";

export type WeatherCondition = "CLEAR" | "CLOUDY" | "RAIN" | "THUNDERSTORM" | "HOT" | "HAZY" | "SNOW";

// A background effect over the map, keyed off the real condition
// getCurrentWeather() returns (see api.ts/weather.routes.js) — a tint
// plus a small bit of motion so "it's raining" or "it's hot right now"
// reads at a glance without needing to read a temperature number.
// Deliberately pointerEvents="none" and semi-transparent throughout —
// this sits over a live/interactive map, it can never block a tap or
// hide the route underneath it.
const TINTS: Record<WeatherCondition, string> = {
  CLEAR: "rgba(135, 206, 250, 0.10)",
  CLOUDY: "rgba(120, 120, 130, 0.20)",
  HAZY: "rgba(150, 140, 120, 0.22)",
  RAIN: "rgba(70, 90, 120, 0.28)",
  THUNDERSTORM: "rgba(40, 45, 60, 0.38)",
  HOT: "rgba(255, 150, 40, 0.22)",
  SNOW: "rgba(210, 225, 240, 0.28)",
};

// Every animated layer below is sized/paced relative to the ACTUAL
// measured container (via onLayout), not a hardcoded screen height —
// this same component renders inside a full-screen map (RouteMapScreen,
// LiveTrackingScreen's ~280px strip) AND a ~150-170px mini map card
// (RouteMiniMap, on every pre-ride screen). A raindrop animated across
// a full phone screen's height in under a second is a blur; the same
// animation confined to a 160px card is invisible — it transits the
// entire visible area in under 200ms, most of the time with the layer
// simply between drops. Measuring the real container and scaling to it
// is what makes "the weather effect doesn't seem to do anything" not
// happen regardless of which screen this is on.
function RainLayer({ intense, width, height }: { intense: boolean; width: number; height: number }) {
  const count = intense ? 16 : 10;
  const drops = useRef(
    Array.from({ length: count }).map(() => ({
      left: Math.random() * 100,
      delay: Math.random() * 900,
      y: new Animated.Value(0),
    }))
  ).current;
  // A drop should take a beat to visibly cross the card, not blur past
  // in one frame — scaled to the real height, floored so a tiny card
  // still shows motion rather than a flicker.
  const duration = Math.max(650, height * 5);

  useEffect(() => {
    const loops = drops.map((d) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(d.delay),
          Animated.timing(d.y, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(d.y, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [duration]);

  return (
    <>
      {drops.map((d, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.drop,
            {
              left: `${d.left}%`,
              height: Math.max(10, height * 0.12),
              opacity: intense ? 0.65 : 0.5,
              transform: [{ translateY: d.y.interpolate({ inputRange: [0, 1], outputRange: [-16, height + 16] }) }],
            },
          ]}
        />
      ))}
    </>
  );
}

function DriftingClouds({ width, height }: { width: number; height: number }) {
  const cloudCount = height < 200 ? 2 : 3;
  const clouds = useRef(
    Array.from({ length: cloudCount }).map((_, i) => ({
      topFrac: 0.12 + i * 0.32,
      sizeFrac: 0.42 + i * 0.12,
      duration: 9000 + i * 3000,
      x: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    const loops = clouds.map((c) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(c.x, { toValue: 1, duration: c.duration, useNativeDriver: true }),
          Animated.timing(c.x, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <>
      {clouds.map((c, i) => {
        const size = Math.max(40, width * c.sizeFrac);
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.cloud,
              {
                top: height * c.topFrac,
                width: size,
                height: size * 0.5,
                transform: [{ translateX: c.x.interpolate({ inputRange: [0, 1], outputRange: [-size, width + size] }) }],
              },
            ]}
          />
        );
      })}
    </>
  );
}

function HeatGlow({ width, height }: { width: number; height: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.85] });
  // Sized/positioned as a fraction of the real container so the glow
  // always actually sits inside the visible card, just spilling from a
  // corner — not a fixed 180px circle that's mostly off-bounds on
  // anything shorter than that.
  const size = Math.max(70, Math.min(width, height * 1.6) * 0.75);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sunGlow,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          top: -size * 0.35,
          right: -size * 0.25,
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
}

export function WeatherEffectOverlay({ condition }: { condition: WeatherCondition }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.clip]} onLayout={handleLayout}>
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: TINTS[condition] || TINTS.CLEAR }]} />
      {size && (condition === "RAIN" || condition === "THUNDERSTORM") && (
        <RainLayer intense={condition === "THUNDERSTORM"} width={size.width} height={size.height} />
      )}
      {size && (condition === "CLOUDY" || condition === "HAZY") && <DriftingClouds width={size.width} height={size.height} />}
      {size && condition === "HOT" && <HeatGlow width={size.width} height={size.height} />}
      {size && condition === "SNOW" && <RainLayer intense={false} width={size.width} height={size.height} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // Decorative layers are positioned as fractions of the real container
  // and can still nudge slightly outside it (the heat glow deliberately
  // spills past the top-right corner) — clipped here so that's a soft
  // "spilling from offscreen" look on every platform, not an
  // Android-only leak past the card's own rounded corners (iOS clips
  // views by default, Android doesn't unless told to).
  clip: { overflow: "hidden" },
  drop: { position: "absolute", top: 0, width: 2, borderRadius: 1, backgroundColor: "rgba(210, 225, 245, 0.95)" },
  cloud: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.4)" },
  sunGlow: { position: "absolute", backgroundColor: "rgba(255, 190, 90, 0.5)" },
});
