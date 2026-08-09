import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme/theme";

type Stop = { placeName: string; distanceKm: number; durationMinutes: number };

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// The full step-by-step route — every auto-detected place along the way
// with its distance/ETA from the start, not just the two endpoints (see
// RouteTimeline for that condensed view, still used on search-result
// cards). Only rendered when the ride actually has a computed route
// (BookingConfirmScreen falls back to RouteTimeline otherwise).
export function RouteStopsList({ stops, departAt }: { stops: Stop[]; departAt: string }) {
  const departTime = new Date(departAt).getTime();
  const [rowCenters, setRowCenters] = useState<number[]>([]);
  const carY = useRef(new Animated.Value(0)).current;
  const hasAnimated = useRef(false);

  function handleRowLayout(index: number, y: number, height: number) {
    setRowCenters((prev) => {
      const next = [...prev];
      next[index] = y + height / 2 - 9;
      return next;
    });
  }

  useEffect(() => {
    if (hasAnimated.current) return;
    if (rowCenters.length !== stops.length || rowCenters.some((y) => y == null)) return;
    hasAnimated.current = true;
    // A one-time preview of the whole trip — the car drives from source
    // to destination once when this route is first shown, rather than
    // looping forever (this is a route preview, not a live position; an
    // endless loop here would just be decoration for its own sake).
    carY.setValue(rowCenters[0]);
    Animated.timing(carY, {
      toValue: rowCenters[rowCenters.length - 1],
      duration: 1800,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [rowCenters.length]);

  return (
    <View style={{ position: "relative" }}>
      {rowCenters.length === stops.length && (
        <Animated.View style={[styles.carBadge, { transform: [{ translateY: carY }] }]} pointerEvents="none">
          <Ionicons name="car-sport" size={11} color="#FFFFFF" />
        </Animated.View>
      )}
      {stops.map((stop, i) => (
        <View
          key={i}
          style={styles.row}
          onLayout={(e) => handleRowLayout(i, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
        >
          <View style={styles.rail}>
            <View style={[styles.dot, i === 0 && styles.dotStart, i === stops.length - 1 && styles.dotEnd]} />
            {i < stops.length - 1 && <View style={styles.line} />}
          </View>
          <View style={styles.point}>
            <Text style={styles.placeName}>{stop.placeName}</Text>
            <Text style={styles.meta}>
              {new Date(departTime + stop.durationMinutes * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              {stop.distanceKm > 0 && ` · ${stop.distanceKm} km in`}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 0 },
  row: { flexDirection: "row", gap: spacing.sm },
  rail: { alignItems: "center", width: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textMuted },
  dotStart: { backgroundColor: colors.accent },
  dotEnd: { backgroundColor: colors.danger },
  line: { width: 1, flex: 1, minHeight: 24, backgroundColor: colors.border, marginVertical: 2 },
  point: { flex: 1, paddingBottom: spacing.sm },
  placeName: { ...typography.caption, fontWeight: "700", color: colors.textPrimary },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  carBadge: {
    position: "absolute", left: -5, top: 0, width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.marigold, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.surface, zIndex: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3,
  },
});
