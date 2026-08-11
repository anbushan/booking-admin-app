import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
// expo-file-system v19 (SDK 54) moved cacheDirectory/writeAsStringAsync
// behind this subpath — the new top-level API is a class-based
// File/Directory model that doesn't have a matching drop-in for this
// simple "write one string, hand it to the share sheet" use case.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { CarLoader } from "../components/CarLoader";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

// A static, non-expiring alternative to requesting a fresh SMS OTP every
// login (see auth.routes.js's own comment on why it's kept separate from
// and stricter-guarded than OTP). This screen only ever handles
// generating + downloading + revoking it — the login screen that
// actually accepts it lives in OtpScreens.tsx (PhoneEntryScreen's
// "Log in with passcode instead" mode).
//
// The contents of the downloaded .txt file itself are left in English
// regardless of app locale — it's a technical artifact handed to the
// user to keep, not part of the in-app reading experience.
function passcodeFileContents(phone: string, passcode: string) {
  return [
    "NanbaGO login passcode",
    "",
    `Phone: +91 ${phone}`,
    `Passcode: ${passcode}`,
    "",
    "Use this to log in instead of requesting an SMS OTP — enter your",
    "phone number, tap \"Log in with passcode instead\", then this code.",
    "",
    "Keep this file private. Anyone with it can log in as you. If you",
    "lose it or think someone else has seen it, open Settings > Login",
    "passcode in the app and generate a new one — that immediately",
    "cancels this one.",
  ].join("\n");
}

export default function LoginPasscodeScreen({ navigation }: any) {
  useScreenView("LoginPasscodeScreen");
  const { t } = useTranslation();
  const [profile, setProfile] = useState<{ phone: string; hasPasscode: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    api.getMyProfile().then(setProfile).catch(() => {});
  }, []);

  async function handleGenerate() {
    setBusy(true);
    try {
      const { passcode, phone } = await api.generatePasscode();
      const fileUri = FileSystem.cacheDirectory + "nanbago-login-passcode.txt";
      await FileSystem.writeAsStringAsync(fileUri, passcodeFileContents(phone, passcode));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/plain",
          dialogTitle: t("loginPasscode.saveDialogTitle"),
        });
      } else {
        // No share sheet available (rare) — at least show the code once
        // so generating wasn't a dead end.
        showAlert(t("loginPasscode.yourPasscodeTitle"), t("loginPasscode.yourPasscodeBody", { passcode }));
      }
      setProfile((p) => (p ? { ...p, hasPasscode: true } : p));
      showSuccess(t("loginPasscode.passcodeReady"));
    } catch (err: any) {
      showError(err.message || t("loginPasscode.couldntGenerate"));
    } finally {
      setBusy(false);
    }
  }

  function confirmRevoke() {
    showAlert(t("loginPasscode.revokeConfirmTitle"), t("loginPasscode.revokeConfirmBody"), [
      { text: t("sideMenu.cancel"), style: "cancel" },
      { text: t("loginPasscode.revoke"), style: "destructive", onPress: handleRevoke },
    ]);
  }

  async function handleRevoke() {
    setBusy(true);
    try {
      await api.revokePasscode();
      setProfile((p) => (p ? { ...p, hasPasscode: false } : p));
      showSuccess(t("loginPasscode.passcodeRevoked"));
    } catch (err: any) {
      showError(err.message || t("loginPasscode.couldntRevoke"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("loginPasscode.title")} onBack={() => navigation.goBack()} />

      {!profile ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader />
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.brandIcon}>
            <Ionicons name="key-outline" size={24} color={colors.accentText} />
          </View>
          <Text style={styles.title}>{t("loginPasscode.skipSmsWait")}</Text>
          <Text style={styles.subtitle}>{t("loginPasscode.description")}</Text>

          <View style={styles.warning}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
            <Text style={styles.warningText}>{t("loginPasscode.warning")}</Text>
          </View>

          {profile.hasPasscode ? (
            <>
              <View style={styles.statusRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.statusText}>{t("loginPasscode.activeStatus")}</Text>
              </View>
              <Pressable style={styles.button} onPress={handleGenerate} disabled={busy}>
                <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
                <Text style={styles.buttonText}>{busy ? t("loginPasscode.working") : t("loginPasscode.generateNew")}</Text>
              </Pressable>
              <Text style={styles.hint}>{t("loginPasscode.regenerateHint")}</Text>
              <Pressable style={styles.revokeButton} onPress={confirmRevoke} disabled={busy}>
                <Text style={styles.revokeText}>{t("loginPasscode.revokePasscode")}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.button} onPress={handleGenerate} disabled={busy}>
              <Ionicons name="download-outline" size={16} color="#FFFFFF" />
              <Text style={styles.buttonText}>{busy ? t("loginPasscode.working") : t("loginPasscode.generateDownload")}</Text>
            </Pressable>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg },
  brandIcon: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accentBg,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  title: { ...typography.title, fontSize: 18 },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 4, marginBottom: spacing.md, lineHeight: 18 },
  warning: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: colors.warningBg, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.lg },
  warningText: { ...typography.small, color: colors.warning, flex: 1, lineHeight: 17 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  statusText: { ...typography.small, color: colors.success },
  button: {
    flexDirection: "row", gap: spacing.xs,
    backgroundColor: colors.textPrimary, height: 48, borderRadius: radius.sm,
    alignItems: "center", justifyContent: "center",
  },
  buttonText: { ...typography.title, color: "#FFFFFF" },
  hint: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
  revokeButton: { alignItems: "center", justifyContent: "center", marginTop: spacing.lg, padding: spacing.sm },
  revokeText: { ...typography.caption, color: colors.danger, fontWeight: "700" },
});
