import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api, logout } from "../lib/api";
import { CarLoader } from "../components/CarLoader";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

// Re-checks on every focus, not just mount — the whole point is a
// blocker (an active booking, a published ride, a refund mid-flight)
// can resolve itself while this screen sits open (cancel it elsewhere,
// come back), and the button should unlock the moment that happens
// without needing to back out and re-enter this screen.
export default function DeleteAccountScreen({ navigation }: any) {
  useScreenView("DeleteAccountScreen");
  const { t } = useTranslation();
  const [checking, setChecking] = useState(true);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const check = useCallback(() => {
    setChecking(true);
    api.getDeletionCheck()
      .then((res) => setBlockers(res.blockers || []))
      .catch(() => setBlockers([]))
      .finally(() => setChecking(false));
  }, []);

  useFocusEffect(check);

  const canDelete = !checking && blockers.length === 0 && confirmText.trim().toUpperCase() === "DELETE";

  function handleDelete() {
    showAlert(
      t("deleteAccount.confirmTitle"),
      t("deleteAccount.confirmBody"),
      [
        { text: t("sideMenu.cancel"), style: "cancel" },
        {
          text: t("settings.deleteAccount"),
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await api.deleteAccount();
              Analytics.accountDeleted();
              await logout();
              navigation.reset({ index: 0, routes: [{ name: "PhoneEntry" }] });
            } catch (err: any) {
              showAlert(t("deleteAccount.couldntDelete"), err.message || t("payment.pleaseTryAgain"));
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("settings.deleteAccount")} onBack={() => navigation.goBack()} />
      <KeyboardAvoider>
        <View style={styles.body}>
          {checking ? (
            <View style={{ paddingTop: spacing.xl, alignItems: "center" }}>
              <CarLoader size="lg" />
            </View>
          ) : blockers.length > 0 ? (
            <>
              <View style={styles.blockerBanner}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
                <Text style={styles.blockerTitle}>{t("deleteAccount.blockersTitle")}</Text>
              </View>
              {blockers.map((b, i) => (
                <View key={i} style={styles.blockerRow}>
                  <Ionicons name="ellipse" size={6} color={colors.warning} style={{ marginTop: 6 }} />
                  <Text style={styles.blockerText}>{b}</Text>
                </View>
              ))}
              <Pressable style={styles.recheckButton} onPress={check}>
                <Ionicons name="refresh-outline" size={16} color={colors.accentText} />
                <Text style={styles.recheckButtonText}>{t("deleteAccount.checkAgain")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.warnIconWrap}>
                <Ionicons name="warning-outline" size={28} color={colors.danger} />
              </View>
              <Text style={styles.title}>{t("deleteAccount.permanentTitle")}</Text>
              <Text style={styles.subtitle}>{t("deleteAccount.permanentBody")}</Text>

              <Text style={styles.confirmLabel}>{t("deleteAccount.typeToConfirm")}</Text>
              <TextInput
                style={styles.input}
                placeholder="DELETE"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                value={confirmText}
                onChangeText={setConfirmText}
              />

              <Pressable
                style={[styles.deleteButton, !canDelete && { opacity: 0.5 }]}
                onPress={handleDelete}
                disabled={!canDelete || deleting}
              >
                <Ionicons name="trash-outline" size={17} color="#FFFFFF" />
                <Text style={styles.deleteButtonText}>{deleting ? t("deleteAccount.deleting") : t("deleteAccount.deleteMyAccount")}</Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg },
  blockerBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  blockerTitle: { ...typography.title, fontSize: 15, flex: 1 },
  blockerRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.xs },
  blockerText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 19 },
  recheckButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.lg, padding: spacing.sm },
  recheckButtonText: { ...typography.caption, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  warnIconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.dangerBg,
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: spacing.md,
  },
  title: { ...typography.title, fontSize: 18, textAlign: "center" },
  subtitle: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, lineHeight: 20 },
  confirmLabel: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xl, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    height: 46,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  deleteButton: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.danger,
    height: 48,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  deleteButtonText: { ...typography.title, color: "#FFFFFF" },
});
