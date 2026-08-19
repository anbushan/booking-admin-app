import React from "react";
import { StyleSheet } from "react-native";
import { Pressable } from "./Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/theme";

export const BACK_BUTTON_SIZE = 34;

// The one back-arrow treatment used everywhere — a fixed-size tinted
// circle, not a bare icon with an expanded hitSlop sitting loose next
// to whatever's beside it. Used by CloseButton and by screens with a
// custom header.
export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.button}>
      <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: BACK_BUTTON_SIZE,
    height: BACK_BUTTON_SIZE,
    borderRadius: BACK_BUTTON_SIZE / 2,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
