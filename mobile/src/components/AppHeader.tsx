import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme/theme";
import { BackButton, BACK_BUTTON_SIZE } from "./BackButton";
import { CloseButton } from "./CloseButton";

// One toolbar for every screen that used to hand-roll its own
// back+title header (each slightly different padding/border/back-icon
// treatment). Same shape everywhere now: back arrow, title (+ optional
// subtitle), one optional trailing element (a button, a filter chip,
// whatever that screen needs) — so the "chrome" always reads the same
// no matter which screen you're on. `variant="close"` swaps the arrow
// for an "x" for screens that are a self-contained moment (trip code)
// rather than a normal stack level — same dismiss action, honest icon.
type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  variant?: "back" | "close";
  right?: React.ReactNode;
};

export function AppHeader({ title, subtitle, onBack, variant = "back", right }: Props) {
  return (
    <View style={styles.header}>
      {onBack ? (
        variant === "close" ? <CloseButton onPress={onBack} /> : <BackButton onPress={onBack} />
      ) : (
        // Reserves the same width whether or not there's a back button,
        // so the title's start position never shifts screen to screen —
        // and, combined with the fixed-size circle above (not just a
        // bare icon with an expanded hitSlop), there's a real layout
        // box here rather than an oversized invisible tap target that
        // could visually crowd the title next to it.
        <View style={styles.backButtonSpacer} />
      )}
      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  backButtonSpacer: { width: BACK_BUTTON_SIZE },
  titleBlock: { flex: 1, minWidth: 0, marginLeft: spacing.xs },
  title: { ...typography.title },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 1 },
});
