import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { CarLoader } from "../components/CarLoader";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";

// Web build of LoginPasscodeScreen — expo-file-system/expo-sharing's
// native share sheet doesn't exist on web, so this downloads the same
// .txt file via a plain Blob + anchor click instead (the standard
// browser download pattern, no native module involved).
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

function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function LoginPasscodeScreen({ navigation }: any) {
  useScreenView("LoginPasscodeScreen");
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
      downloadTextFile("nanbago-login-passcode.txt", passcodeFileContents(phone, passcode));
      setProfile((p) => (p ? { ...p, hasPasscode: true } : p));
      showSuccess("Passcode downloaded");
    } catch (err: any) {
      showError(err.message || "Couldn't generate a passcode");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!window.confirm("Revoke passcode? The downloaded file stops working immediately.")) return;
    setBusy(true);
    try {
      await api.revokePasscode();
      setProfile((p) => (p ? { ...p, hasPasscode: false } : p));
      showSuccess("Passcode revoked");
    } catch (err: any) {
      showError(err.message || "Couldn't revoke the passcode");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title="Login passcode" onBack={() => navigation.goBack()} />

      {!profile ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader />
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.brandIcon}>
            <Ionicons name="key-outline" size={24} color={colors.accentText} />
          </View>
          <Text style={styles.title}>Skip the SMS wait</Text>
          <Text style={styles.subtitle}>
            Download a 6-digit passcode once, and use it to log in on any device instead of
            requesting a fresh OTP every time.
          </Text>

          <View style={styles.warning}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
            <Text style={styles.warningText}>
              Unlike an OTP, this code doesn't expire on its own — treat the downloaded file like a
              password. Anyone who has it can log in as you.
            </Text>
          </View>

          {profile.hasPasscode ? (
            <>
              <View style={styles.statusRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.statusText}>A passcode is active on this account.</Text>
              </View>
              <Pressable style={styles.button} onPress={handleGenerate} disabled={busy}>
                <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
                <Text style={styles.buttonText}>{busy ? "Working..." : "Generate a new one"}</Text>
              </Pressable>
              <Text style={styles.hint}>Generating a new one immediately cancels the old file.</Text>
              <Pressable style={styles.revokeButton} onPress={handleRevoke} disabled={busy}>
                <Text style={styles.revokeText}>Revoke passcode</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.button} onPress={handleGenerate} disabled={busy}>
              <Ionicons name="download-outline" size={16} color="#FFFFFF" />
              <Text style={styles.buttonText}>{busy ? "Working..." : "Generate & download"}</Text>
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
