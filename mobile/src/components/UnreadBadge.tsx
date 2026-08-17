import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, FONT } from "../theme/theme";

// A small unread-count pill for the Chat action on a booking card
// (HistoryScreen for passengers, UpcomingTripsScreen for drivers).
// Renders nothing at 0 — the caller doesn't need its own conditional.
export function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    marginLeft: spacing.xs,
  },
  text: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", fontFamily: FONT.bold },
});
