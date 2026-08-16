import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "./Pressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography, FONT } from "../theme/theme";

// Zomato-style persistent quick-nav — replaces the hamburger-only path
// into the app on Home. Tabs are supplied by the caller (Home builds a
// different set for a driver vs. a passenger — "Offer a ride" and
// "Booking requests" matter to a driver the way "My requests" does to
// a passenger; a generic "Bookings" tab served neither well). The full
// menu (settings, vehicles, account, logout — everything that doesn't
// fit here) still lives in SideMenu; "menu" just opens that same modal.
export type NavTab = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  badge?: number;
};

type Props = {
  tabs: NavTab[];
  active: string;
  onTabPress: (key: string) => void;
};

export function BottomNavBar({ tabs, active, onTabPress }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const badgeCount = tab.badge ?? 0;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabPress(tab.key)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={badgeCount > 0 ? `${tab.label}, ${badgeCount}` : tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <View>
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={22}
                color={isActive ? colors.accentText : colors.textMuted}
              />
              {badgeCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badgeCount > 9 ? "9+" : badgeCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 2 },
  label: { ...typography.small, fontSize: 10.5, color: colors.textMuted },
  labelActive: { color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700", fontFamily: FONT.bold },
});
