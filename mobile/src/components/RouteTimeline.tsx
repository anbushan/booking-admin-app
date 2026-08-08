import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme/theme";

function formatTime(iso: string) {
  const d = new Date(iso);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

type Props = {
  departAt: string;
  arriveAt: string;
  sourceAddress: string;
  destAddress: string;
  durationMinutes: number;
};

// Departure → arrival step UI — gives the passenger the whole journey
// picture (both ends, both times) instead of just a single departure
// time. Times are estimates (see rides.routes.js estimateArrival — a
// straight-line-distance / assumed-speed guess, not a real routing ETA).
export function RouteTimeline({ departAt, arriveAt, sourceAddress, destAddress, durationMinutes }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: colors.accent }]} />
        <View style={styles.line} />
        <View style={[styles.dot, { backgroundColor: colors.danger }]} />
      </View>
      <View style={styles.points}>
        <View style={styles.point}>
          <Text style={styles.time}>{formatTime(departAt)}</Text>
          <Text style={styles.address} numberOfLines={1}>{sourceAddress}</Text>
        </View>
        <Text style={styles.duration}>~{formatDuration(durationMinutes)}</Text>
        <View style={styles.point}>
          <Text style={styles.time}>{formatTime(arriveAt)} (estimated)</Text>
          <Text style={styles.address} numberOfLines={1}>{destAddress}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  rail: { alignItems: "center", width: 12, paddingTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { width: 1, flex: 1, minHeight: 20, backgroundColor: colors.border, marginVertical: 4 },
  points: { flex: 1, gap: spacing.xs },
  point: {},
  time: { ...typography.caption, fontWeight: "500", color: colors.textPrimary },
  address: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  duration: { ...typography.small, color: colors.textMuted, marginVertical: 2 },
});
