import React, { useState } from "react";
import { View, Text, TextInput, Image, ScrollView, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Button } from "../components/Button";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { FieldError } from "../components/FieldError";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Reached once, right after a brand-new phone number verifies its OTP
// (see OtpScreens.tsx's navigation.reset) — no previous screen to go
// back to, same as PhoneEntryScreen. This is where "am I a driver or a
// passenger" actually gets decided; everything else in the app assumes
// it's already been answered.
export default function RegisterScreen({ navigation }: any) {
  useScreenView("RegisterScreen");
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"PASSENGER" | "DRIVER" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; role?: string }>({});

  function validateForm() {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t("register.nameRequired");
    else if (name.trim().length > 100) next.name = t("register.nameTooLong");
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) next.email = t("register.emailInvalid");
    if (!role) next.role = t("register.roleRequired");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      // whatsappOptIn deliberately not sent here — it was already asked
      // and saved on PhoneEntryScreen (see OtpScreens.tsx), and
      // users.routes.js's PUT /me only overwrites it when the field is
      // actually present in the body. Asking again here with a second,
      // differently-defaulted checkbox meant a new user who left the
      // login-screen one checked (the default there) could get silently
      // opted back out a few taps later without ever touching a
      // checkbox themselves.
      await api.updateProfile({ name: name.trim(), email: email.trim(), role: role! });
      Analytics.signUp(role!);
      navigation.reset({
        index: 0,
        routes: [{ name: role === "DRIVER" ? "DriverOnboarding" : "Home" }],
      });
    } catch (err: any) {
      showAlert(t("register.couldntSaveProfile"), err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoider>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandIcon}>
            <Image source={require("../../assets/brand-mark.png")} style={styles.brandIconImage} resizeMode="contain" />
          </View>
          <Text style={styles.title}>{t("register.title")}</Text>
          <Text style={styles.subtitle}>{t("register.subtitle")}</Text>

          <Text style={styles.label}>{t("register.nameLabel")}</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder={t("register.namePlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={(v) => { setName(v); if (errors.name) setErrors((e) => ({ ...e, name: undefined })); }}
          />
          <FieldError message={errors.name} />

          <Text style={styles.label}>{t("register.emailLabel")}</Text>
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder={t("register.emailPlaceholder")}
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(v) => { setEmail(v); if (errors.email) setErrors((e) => ({ ...e, email: undefined })); }}
          />
          {/* Was a bare "Email (optional)" label with no reason given to
              actually fill it in — this is the same field/storage, just
              framed around what leaving it gets a rider (booking
              reminders), which is what the label change was actually
              asking for. No email currently gets sent to it yet — that's
              a separate, real feature (needs a transactional email
              provider wired up, none exists in this stack today) tracked
              on its own, not implied by this copy change. */}
          <Text style={styles.emailHint}>{t("register.emailHint")}</Text>
          <FieldError message={errors.email} />

          <Text style={styles.label}>{t("register.roleLabel")}</Text>
          <View style={styles.roleRow}>
            <Pressable
              style={[styles.roleCard, role === "PASSENGER" && styles.roleCardActive]}
              onPress={() => { setRole("PASSENGER"); setErrors((e) => ({ ...e, role: undefined })); }}
            >
              {role === "PASSENGER" && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                </View>
              )}
              <View style={[styles.roleIconWrap, role === "PASSENGER" && styles.roleIconWrapActive]}>
                <Ionicons name="person" size={24} color={role === "PASSENGER" ? "#FFFFFF" : colors.accentText} />
              </View>
              <Text style={[styles.roleText, role === "PASSENGER" && styles.roleTextActive]}>{t("register.passenger")}</Text>
              <Text style={styles.roleSub}>{t("register.passengerSub")}</Text>
            </Pressable>
            <Pressable
              style={[styles.roleCard, role === "DRIVER" && styles.roleCardActive]}
              onPress={() => { setRole("DRIVER"); setErrors((e) => ({ ...e, role: undefined })); }}
            >
              {role === "DRIVER" && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                </View>
              )}
              <View style={[styles.roleIconWrap, role === "DRIVER" && styles.roleIconWrapActive]}>
                <Ionicons name="car-sport" size={24} color={role === "DRIVER" ? "#FFFFFF" : colors.accentText} />
              </View>
              <Text style={[styles.roleText, role === "DRIVER" && styles.roleTextActive]}>{t("register.driver")}</Text>
              <Text style={styles.roleSub}>{t("register.driverSub")}</Text>
            </Pressable>
          </View>
          <FieldError message={errors.role} />

          <Button
            title={submitting ? t("register.saving") : t("register.continue")}
            icon="arrow-forward-circle-outline"
            loading={submitting}
            onPress={handleSubmit}
            style={{ marginTop: spacing.xl }}
          />
        </ScrollView>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, flexGrow: 1, justifyContent: "center" },
  brandIcon: {
    width: 56, height: 56, borderRadius: 18, backgroundColor: "#FFFFFF", padding: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: spacing.md,
  },
  brandIconImage: { width: "100%", height: "100%" },
  title: { ...typography.titleCompact, textAlign: "center" },
  subtitle: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.lg },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  emailHint: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
  },
  inputError: { borderColor: colors.danger },
  roleRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  roleCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  roleCardActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  checkBadge: {
    position: "absolute", top: spacing.sm, right: spacing.sm,
    width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent,
    alignItems: "center", justifyContent: "center",
  },
  roleIconWrap: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bg,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  roleIconWrapActive: { backgroundColor: colors.accent },
  roleText: { ...typography.title, fontSize: 14 },
  roleTextActive: { color: colors.accentText },
  roleSub: { ...typography.small, color: colors.textMuted, marginTop: 2, textAlign: "center" },
});
