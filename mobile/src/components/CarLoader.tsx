import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme/theme";

const SIZES = { sm: 128, md: 220, lg: 320 };

// The app's own loading indicator — a real illustrated GIF (a driver
// waving from a moving car, wheels spinning) rather than the plain
// native ActivityIndicator spinner, shown on every full-page load. This
// replaces an earlier version that hand-animated an Ionicons car icon
// back and forth with Animated.Value — that icon turned out to be a
// symmetric front-on car (not a side profile), so no amount of flipping
// ever gave it a "direction," and the whole hand-built scene (motion
// lines, ground shadow, dashed road) was never going to look as good as
// an actual illustration. `label`, when given, sits under it — every
// existing call site omits it and is unaffected.
export function CarLoader({ size = "md", label }: { size?: "sm" | "md" | "lg"; label?: string }) {
  const dimension = SIZES[size];
  return (
    <View style={styles.wrap}>
      <Image
        source={require("../../assets/loading.gif")}
        style={{ width: dimension, height: dimension }}
        resizeMode="contain"
      />
      {!!label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  label: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
});
