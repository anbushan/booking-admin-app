import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { FieldError } from "../components/FieldError";
import { SafeAreaView } from "react-native-safe-area-context";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ navigation }: any) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"PASSENGER" | "DRIVER" | null>(null);
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
      await api.updateProfile({ name: name.trim(), email: email.trim(), role: role! });
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
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.title}>Tell us about you</Text>

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
          <Text style={[styles.roleText, role === "PASSENGER" && styles.roleTextActive]}>
            Book rides
          </Text>
          <Text style={styles.roleSub}>Passenger</Text>
        </Pressable>
        <Pressable
          style={[styles.roleCard, role === "DRIVER" && styles.roleCardActive]}
          onPress={() => { setRole("DRIVER"); setErrors((e) => ({ ...e, role: undefined })); }}
        >
          <Text style={[styles.roleText, role === "DRIVER" && styles.roleTextActive]}>
            Offer rides
          </Text>
          <Text style={styles.roleSub}>Driver</Text>
        </Pressable>
      </View>
      <FieldError message={errors.role} />

      <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? "Saving..." : "Continue"}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: "center" },
  title: { ...typography.title, fontSize: 18, marginBottom: spacing.lg },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    height: 44,
    paddingHorizontal: spacing.md,
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
  },
  roleCardActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  roleText: { ...typography.title, fontSize: 14 },
  roleTextActive: { color: colors.accentText },
  roleSub: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  button: {
    backgroundColor: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  buttonText: { color: "#FFFFFF", ...typography.title },
});
