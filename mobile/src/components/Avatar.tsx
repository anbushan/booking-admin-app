import React from "react";
import { View, Text, Image, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { colors, typography, FONT } from "../theme/theme";

// Every screen that shows a person (driver/passenger) drew its own
// initial-in-a-circle placeholder and never had anywhere to show a real
// uploaded profile photo. Now that users.routes.js/rides.routes.js resolve
// a real `photoViewUrl` (short-lived signed R2 URL) alongside name, this is
// the one place that decides "photo if we have one, else initial circle" —
// same fallback everywhere instead of re-implementing it per screen.
export default function Avatar({
  uri,
  name,
  size = 40,
  fallbackStyle,
  fallbackTextStyle,
}: {
  uri?: string | null;
  name?: string | null;
  size?: number;
  // Overrides the initials-circle's background/text color — needed on a
  // colored header (HomeScreen's translucent-white avatar button) where
  // the default neutral accentBg circle would clash if there's no photo
  // to fill it. Only applies to the no-photo fallback; a real photo
  // always renders plain.
  fallbackStyle?: ViewStyle;
  fallbackTextStyle?: TextStyle;
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, dimensionStyle]} />;
  }
  return (
    <View style={[styles.fallback, dimensionStyle, fallbackStyle]}>
      <Text style={[styles.fallbackText, { fontSize: size * 0.4 }, fallbackTextStyle]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.accentBg },
  fallback: { backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  fallbackText: { ...typography.title, fontWeight: "700", fontFamily: FONT.bold, color: colors.accentText },
});
