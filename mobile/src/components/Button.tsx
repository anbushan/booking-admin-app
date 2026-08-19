import React from "react";
import { Text, StyleSheet, ActivityIndicator, StyleProp, ViewStyle } from "react-native";
import { Pressable } from "./Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { haptics } from "../lib/haptics";

// The primary CTA button existed independently in ~10+ screens before
// this — OtpScreens, RegisterScreen, LanguageSelectionScreen,
// MapPinConfirmScreen(.web), AddVehicleScreen — all converged on the
// exact same recipe by hand (colors.textPrimary bg, ~46-50px height,
// radius.sm, disabled state, a ternary text-swap for "loading"). This
// names that pattern once instead of a 6th/7th/8th copy of it, and adds
// what none of those copies had: a real spinner instead of the label
// just changing text, and haptic feedback on every tap for free (see
// lib/haptics.ts) with zero change needed at any call site.
//
// Built strictly on the app's own Pressable wrapper (not raw RN
// Pressable/TouchableOpacity) — that's the one thing every tappable
// element in this app already gets right (ripple on Android, a
// radius-matched translucent overlay on iOS), so Button inherits it
// rather than reinventing feedback a second, different way.
export type ButtonVariant = "primary" | "secondary" | "outline" | "danger";
export type ButtonSize = "md" | "lg";

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; fg: string; borderColor?: string }> = {
  primary: { bg: colors.textPrimary, fg: "#FFFFFF" },
  // Reuses the existing accent tokens — no new color introduced.
  secondary: { bg: colors.accentBg, fg: colors.accentText },
  // Matches BookingDetailScreen's existing actionButton recipe.
  outline: { bg: colors.surface, fg: colors.accentText, borderColor: colors.border },
  // Matches DeleteAccountScreen's existing deleteButton recipe.
  danger: { bg: colors.danger, fg: "#FFFFFF" },
};

const SIZE_HEIGHT: Record<ButtonSize, number> = { md: 46, lg: 50 };

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "lg",
  loading = false,
  disabled = false,
  icon,
  style,
  fullWidth = true,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}) {
  const { bg, fg, borderColor } = VARIANT_STYLES[variant];
  const isDisabled = disabled || loading;

  function handlePress() {
    haptics.tap();
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={[
        styles.base,
        {
          backgroundColor: bg,
          height: SIZE_HEIGHT[size],
          borderRadius: radius.sm,
          borderWidth: borderColor ? 1 : 0,
          borderColor: borderColor || "transparent",
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          paddingHorizontal: spacing.lg,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        icon && <Ionicons name={icon} size={18} color={fg} />
      )}
      <Text style={[styles.text, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  text: typography.title,
});
