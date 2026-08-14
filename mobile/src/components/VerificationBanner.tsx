import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "./Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { useTranslation } from "../lib/i18n/I18nContext";

// One shared banner for "get verified" / "you're verified" — used on
// both Home and VehicleList so a driver sees the same visual language
// wherever it shows up, instead of two hand-rolled versions drifting
// apart over time. A circular icon badge + title/subtitle reads as a
// real status card rather than a thin strip of text.
export function VerificationBanner({ verified, onPress }: { verified: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable style={[styles.banner, verified ? styles.bannerDone : styles.bannerPending]} onPress={onPress}>
      <View style={[styles.iconBadge, { backgroundColor: verified ? colors.success : colors.accent }]}>
        <Ionicons name={verified ? "checkmark" : "shield-checkmark"} size={17} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: verified ? colors.success : colors.accentText }]}>
          {verified ? t("verification.youAreVerified") : t("verification.getVerifiedFaster")}
        </Text>
        <Text style={styles.subtitle}>
          {verified ? t("verification.bannerDoneSubtitle") : t("verification.bannerPendingSubtitle")}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={verified ? colors.success : colors.accentText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    borderRadius: radius.md, padding: spacing.md,
  },
  bannerPending: { backgroundColor: colors.accentBg },
  bannerDone: { backgroundColor: colors.successBg },
  iconBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  title: { ...typography.caption, fontWeight: "700", fontFamily: FONT.bold },
  subtitle: { ...typography.small, color: colors.textSecondary, marginTop: 1, lineHeight: 15 },
});
