import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { FieldError } from "../components/FieldError";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { SafeAreaView } from "react-native-safe-area-context";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Reached once, right after a brand-new phone number verifies its OTP
// (see OtpScreens.tsx's navigation.reset) — no previous screen to go
// back to, same as PhoneEntryScreen. This is where "am I a driver or a
// passenger" actually gets decided; everything else in the app assumes
// it's already been answered.
export default function RegisterScreen({ navigation }: any) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"PASSENGER" | "DRIVER" | null>(null);
  // Opt-in, defaults unchecked — nothing in this codebase sends WhatsApp
  // messages yet (see User.whatsappOptIn in the schema), but whatever
  // eventually does should only message people who actually asked for it.
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; role?: string }>({});

  function validateForm() {
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Name is required.";
    else if (name.trim().length > 100) next.name = "Name is too long.";
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) next.email = "Enter a valid email address.";
    if (!role) next.role = "Select whether you're a driver or a passenger.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      await api.updateProfile({ name: name.trim(), email: email.trim(), role: role!, whatsappOptIn });
      Analytics.signUp(role!);
      navigation.reset({
        index: 0,
        routes: [{ name: role === "DRIVER" ? "DriverOnboarding" : "Home" }],
      });
    } catch (err: any) {
      showAlert("Couldn't save profile", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoider>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandIcon}>
            <Ionicons name="person-add-outline" size={26} color={colors.accentText} />
          </View>
          <Text style={styles.title}>Tell us about you</Text>
          <Text style={styles.subtitle}>Just a couple of details before you get going.</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="Your full name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={(v) => { setName(v); if (errors.name) setErrors((e) => ({ ...e, name: undefined })); }}
          />
          <FieldError message={errors.name} />

          <Text style={styles.label}>Email (optional)</Text>
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(v) => { setEmail(v); if (errors.email) setErrors((e) => ({ ...e, email: undefined })); }}
          />
          <FieldError message={errors.email} />

          <Text style={styles.label}>I want to</Text>
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
              <Text style={[styles.roleText, role === "PASSENGER" && styles.roleTextActive]}>Passenger</Text>
              <Text style={styles.roleSub}>Search and book rides</Text>
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
              <Text style={[styles.roleText, role === "DRIVER" && styles.roleTextActive]}>Driver</Text>
              <Text style={styles.roleSub}>Offer rides, earn money</Text>
            </Pressable>
          </View>
          <FieldError message={errors.role} />

          <Pressable style={styles.checkboxRow} onPress={() => setWhatsappOptIn((v) => !v)}>
            <View style={[styles.checkbox, whatsappOptIn && styles.checkboxChecked]}>
              {whatsappOptIn && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
            </View>
            <Text style={styles.checkboxLabel}>Get WhatsApp updates</Text>
          </Pressable>

          <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
            {!submitting && <Ionicons name="arrow-forward-circle-outline" size={18} color="#FFFFFF" />}
            <Text style={styles.buttonText}>{submitting ? "Saving..." : "Continue"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, flexGrow: 1, justifyContent: "center" },
  brandIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentBg,
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: spacing.md,
  },
  title: { ...typography.title, fontSize: 18, textAlign: "center" },
  subtitle: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: 4, marginBottom: spacing.lg },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
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
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg, padding: spacing.xs },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxLabel: { ...typography.caption, color: colors.textSecondary },
  button: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.accent,
    height: 48,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  buttonText: { ...typography.title, color: "#FFFFFF" },
});
