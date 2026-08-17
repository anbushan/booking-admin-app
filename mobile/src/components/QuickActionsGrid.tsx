import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "./Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography, FONT } from "../theme/theme";

export type QuickAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badge?: number;
  // Tints the icon circle so a handful of tiles read as visually
  // distinct at a glance (e.g. a danger-tinted Emergency Contacts
  // tile) without turning the grid into a rainbow — same restraint
  // the rest of the app already applies to color (theme.ts's marigold
  // comment: one deliberate accent, used sparingly).
  tint?: "accent" | "marigold" | "success" | "danger";
};

const TINTS: Record<NonNullable<QuickAction["tint"]>, { bg: string; fg: string }> = {
  accent: { bg: colors.accentBg, fg: colors.accentText },
  marigold: { bg: colors.marigoldBg, fg: colors.marigoldText },
  success: { bg: colors.successBg, fg: colors.success },
  danger: { bg: colors.dangerBg, fg: colors.danger },
};

// A visual, icon-first alternative to a plain list of text rows — the
// "quick actions" grid pattern most everyday apps use (Paytm/PhonePe/
// Zomato-style dashboards) for the handful of things someone reaches
// for constantly. Reuses the exact same badge visual language as
// BottomNavBar/AccountScreen (red circle, white bold count, "9+" cap)
// so a number here means the same thing it does everywhere else.
// 3 tiles per row — 6 actions fills exactly two rows with nothing
// dangling on its own.
export function QuickActionsGrid({ actions }: { actions: QuickAction[] }) {
  return (
    <View style={styles.grid}>
      {actions.map((action) => {
        const tint = TINTS[action.tint ?? "accent"];
        return (
          <Pressable
            key={action.key}
            style={styles.tile}
            onPress={action.onPress}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <View style={[styles.iconCircle, { backgroundColor: tint.bg }]}>
              <Ionicons name={action.icon} size={24} color={tint.fg} />
              {!!action.badge && action.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{action.badge > 9 ? "9+" : action.badge}</Text>
                </View>
              )}
            </View>
            <Text style={styles.label} numberOfLines={2}>{action.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap" },
  // >44px effective tap area even before hitSlop (56px circle + label),
  // comfortably clearing the usual minimum recommended touch-target size.
  tile: { width: "33.33%", alignItems: "center", paddingVertical: spacing.sm, gap: 6 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  label: { ...typography.small, color: colors.textSecondary, textAlign: "center", lineHeight: 14 },
  badge: {
    position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9,
    paddingHorizontal: 3, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: colors.surface,
  },
  badgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700", fontFamily: FONT.bold },
});
