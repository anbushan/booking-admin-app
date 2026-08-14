import React from "react";
import { Modal, View, Text, StyleSheet } from "react-native";
import { Pressable } from "./Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { useTranslation } from "../lib/i18n/I18nContext";

type Props = {
  visible: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  allowLabel?: string;
  allowing?: boolean;
  // Present once the OS has already permanently denied this (Android's
  // "don't ask again", or iOS after a first refusal) — requestPermissionsAsync()
  // would just silently re-deny at that point instead of prompting, so
  // the only real next step is Settings, not another in-app ask.
  blocked?: boolean;
  onAllow: () => void;
  onNotNow: () => void;
};

// The "ask before asking" pattern LocationPermissionPrimingScreen
// established for location (explain why first — only the real OS
// dialog fires after an explicit tap here) — as a modal instead of a
// full screen, for permissions that come up mid-flow (microphone,
// photo library) rather than once at onboarding. Two ways out, same as
// that screen: Allow (triggers the real OS prompt) or Not now (skips,
// never blocks whatever flow asked for it). Reuse this for any future
// permission prompt instead of calling requestPermissionsAsync() cold
// — a bare OS dialog with no context is what drives reflexive denials.
export function PermissionModal({ visible, icon, title, description, allowLabel, allowing, blocked, onAllow, onNotNow }: Props) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNotNow}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name={icon} size={26} color={colors.accentText} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>
            {blocked ? t("permissionModal.blockedDescription") : description}
          </Text>
          <Pressable style={styles.allowButton} onPress={onAllow} disabled={allowing}>
            <Text style={styles.allowButtonText}>
              {allowing
                ? t("permissionModal.requesting")
                : blocked
                ? t("permissionModal.openSettings")
                : allowLabel || t("permissionModal.allow")}
            </Text>
          </Pressable>
          <Pressable style={styles.notNowButton} onPress={onNotNow} disabled={allowing}>
            <Text style={styles.notNowButtonText}>{t("permissionModal.notNow")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", width: "100%", maxWidth: 340 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title: { ...typography.title, fontSize: 16, textAlign: "center" },
  description: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs, lineHeight: 19 },
  allowButton: { backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.lg, alignSelf: "stretch" },
  allowButtonText: { ...typography.title, color: "#FFFFFF" },
  notNowButton: { marginTop: spacing.sm, padding: spacing.xs },
  notNowButtonText: { ...typography.caption, color: colors.textMuted },
});
