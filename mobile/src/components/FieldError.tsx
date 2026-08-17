import React from "react";
import { Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme/theme";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.text}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: { ...typography.small, color: colors.danger, marginTop: spacing.xs },
});
