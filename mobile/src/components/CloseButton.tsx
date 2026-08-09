import React from "react";
import { StyleSheet } from "react-native";
import { Pressable } from "./Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/theme";
import { BACK_BUTTON_SIZE } from "./BackButton";

// The "dismiss this screen" counterpart to BackButton — same tinted
// circle treatment, same fixed size, just an "x" instead of an arrow.
// For screens that were pushed as a self-contained flow (trip code,
// OTP-style full-screen moments) rather than a normal stack level, "x"
// reads correctly where an arrow implies "go to the previous screen".
export function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.button}>
      <Ionicons name="close" size={19} color={colors.textPrimary} />
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
