import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Dimensions } from "react-native";

export type WeatherCondition = "CLEAR" | "CLOUDY" | "RAIN" | "THUNDERSTORM" | "HOT" | "HAZY" | "SNOW";

const { height: SCREEN_H } = Dimensions.get("window");

// A background effect over the map, keyed off the real condition
// getCurrentWeather() returns (see api.ts/weather.routes.js) — a tint
// plus a small bit of motion so "it's raining" or "it's hot right now"
// reads at a glance without needing to read a temperature number.
// Deliberately pointerEvents="none" and semi-transparent throughout —
// this sits over a live/interactive map, it can never block a tap or
// hide the route underneath it.
const TINTS: Record<WeatherCondition, string> = {
  CLEAR: "rgba(135, 206, 250, 0.06)",
  CLOUDY: "rgba(120, 120, 130, 0.14)",
  HAZY: "rgba(150, 140, 120, 0.16)",
  RAIN: "rgba(70, 90, 120, 0.20)",
  THUNDERSTORM: "rgba(40, 45, 60, 0.30)",
  HOT: "rgba(255, 150, 40, 0.14)",
  SNOW: "rgba(210, 225, 240, 0.20)",
};

function RainLayer({ intense }: { intense: boolean }) {
  const count = intense ? 22 : 14;
  const drops = useRef(
    Array.from({ length: count }).map(() => ({
      left: Math.random() * 100,
      delay: Math.random() * 1200,
      duration: 700 + Math.random() * 400,
      y: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    const loops = drops.map((d) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(d.delay),
          Animated.timing(d.y, { toValue: 1, duration: d.duration, useNativeDriver: true }),
          Animated.timing(d.y, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

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
              opacity: intense ? 0.5 : 0.35,
              transform: [{ translateY: d.y.interpolate({ inputRange: [0, 1], outputRange: [-20, SCREEN_H] }) }],
            },
          ]}
        />
      ))}
    </>
  );
}

function DriftingClouds() {
  const clouds = useRef(
    Array.from({ length: 3 }).map((_, i) => ({
      top: 40 + i * 70,
      size: 90 + i * 30,
      duration: 14000 + i * 4000,
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
      {clouds.map((c, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.cloud,
            {
              top: c.top,
              width: c.size,
              height: c.size * 0.5,
              transform: [{ translateX: c.x.interpolate({ inputRange: [0, 1], outputRange: [-c.size, 420] }) }],
            },
          ]}
        />
      ))}
    </>
  );
}

function HeatGlow() {
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
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.8] });
  return <Animated.View pointerEvents="none" style={[styles.sunGlow, { transform: [{ scale }], opacity }]} />;
}

export function WeatherEffectOverlay({ condition }: { condition: WeatherCondition }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: TINTS[condition] || TINTS.CLEAR }]} />
      {(condition === "RAIN" || condition === "THUNDERSTORM") && <RainLayer intense={condition === "THUNDERSTORM"} />}
      {(condition === "CLOUDY" || condition === "HAZY") && <DriftingClouds />}
      {condition === "HOT" && <HeatGlow />}
      {condition === "SNOW" && <RainLayer intense={false} />}
    </View>
  );
}

const styles = StyleSheet.create({
  drop: { position: "absolute", top: 0, width: 2, height: 16, borderRadius: 1, backgroundColor: "rgba(210, 225, 245, 0.9)" },
  cloud: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.35)" },
  sunGlow: {
    position: "absolute", top: -60, right: -40, width: 180, height: 180, borderRadius: 90,
    backgroundColor: "rgba(255, 190, 90, 0.45)",
  },
});
