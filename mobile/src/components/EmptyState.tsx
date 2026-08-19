import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { colors, spacing, typography, FONT } from "../theme/theme";

// One consistent "no data" illustration for every empty state in the
// app (notifications, vehicles, payment history, ratings...) — the
// same empty-fuel-gauge animation, needle on E, in place of the
// assortment of per-screen icons this used to show. Used to be a
// hand-drawn static version built from plain Views (no shipped asset);
// swapped for the real animated GIF once one was actually provided —
// see docs/brand/nodata-source.gif for the untouched original (cropped
// to drop its watermark, background chroma-keyed to transparent). `icon`
// is accepted for backward compatibility with existing call sites but
// no longer drives what's drawn.
//
// `size="large"` absorbs what used to be a separate NoRidesFound
// component — same illustration, just a bigger/bolder treatment for
// the app's single highest-traffic empty state (search results). It
// was a near-duplicate of this component (same GIF, near-identical
// JSX) with nothing that actually needed a separate file.
export function EmptyState({
  title,
  subtitle,
  icon,
  size = "default",
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  size?: "default" | "large";
}) {
  const large = size === "large";
  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/nodata.gif")}
        style={large ? styles.imageLarge : styles.image}
        resizeMode="contain"
      />
      <Text style={[styles.title, large && styles.titleLarge]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // flex:1 + the list's own contentContainerStyle needing flexGrow:1 is
  // what actually centers this in the middle of the screen — previously
  // just a marginTop nudge, which only pushed it partway down from the
  // top of whatever space the (possibly short) list content left.
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  image: { width: 160, height: 109 },
  imageLarge: { width: 224, height: 153 },
  title: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm },
  titleLarge: { fontWeight: "700", fontFamily: FONT.bold, marginTop: spacing.md },
  subtitle: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs },
});
