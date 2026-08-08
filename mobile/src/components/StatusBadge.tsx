import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getStatusMeta, radius, spacing, typography, toneColors } from "../theme/theme";

// Replaces every bare `<Text style={styles.status}>{item.status}</Text>`
// pattern across the app — pairs an icon with a plain-language label and
// a tinted color, so the state reads before the word does. Pass a raw
// status string (BOOKED, CONFIRMED, PUBLISHED, ...); label/icon/color
// are all derived from theme.ts's statusMeta so every screen agrees on
// what e.g. CONFIRMED looks like.
export function StatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const meta = getStatusMeta(status);
  const tone = toneColors[meta.tone];
  const small = size === "sm";
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }, small && styles.pillSmall]}>
      <Ionicons name={meta.icon as any} size={small ? 12 : 14} color={tone.text} />
      <Text style={[small ? typography.small : typography.caption, styles.label, { color: tone.text }]}>
        {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
  },
  pillSmall: { paddingVertical: 3, paddingHorizontal: 7, gap: 4 },
  label: { fontWeight: "700" },
});
