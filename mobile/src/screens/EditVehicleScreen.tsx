import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { validateVehicle } from "../lib/validators";
import { FieldError } from "../components/FieldError";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

const SEAT_OPTIONS = [4, 5, 6, 7];

export default function EditVehicleScreen({ route, navigation }: any) {
  useScreenView("EditVehicleScreen");
  const { t } = useTranslation();
  const { vehicle } = route.params;
  // Same OR-logic as VehicleListScreen/lib/verification.js: either path
  // to the badge counts. This screen only ever shows the single
  // resulting state now — no more separate PENDING/APPROVED/REJECTED
  // admin-review banners, which described a document-upload flow this
  // screen no longer offers at all.
  const rcVerified = vehicle.verification?.rcStatus === "VERIFIED" || vehicle.status === "APPROVED";
  const [make, setMake] = useState(vehicle.make);
  const [model, setModel] = useState(vehicle.model);
  const [regNumber, setRegNumber] = useState(vehicle.regNumber);
  const [color, setColor] = useState(vehicle.color || "");
  const [seatCapacity, setSeatCapacity] = useState(vehicle.seatCapacity || 4);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSave() {
    const validationErrors = validateVehicle({ make, model, regNumber }, t);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      // No document upload here anymore — same reasoning as
      // AddVehicleScreen: RC/license verification happens through the
      // paid Eko flow instead, which stores its own response as the
      // record of what was checked.
      const updated = await api.updateVehicle(vehicle.id, { make, model, regNumber: regNumber.toUpperCase(), color, seatCapacity });
      // A changed reg number invalidates whatever RC check was on file
      // for the old one (vehicles.routes.js resets it server-side) — say
      // so here, rather than letting the badge just silently vanish the
      // next time they look at the vehicle list.
      if (updated?.rcVerificationReset) {
        showAlert(t("vehicle.regNumberChangedTitle"), t("vehicle.regNumberChangedBody"), [
          { text: t("common.ok"), onPress: () => navigation.goBack() },
        ]);
      } else {
        navigation.goBack();
      }
    } catch (err: any) {
      showAlert(t("common.couldntSave"), err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("vehicle.editVehicle")} onBack={() => navigation.goBack()} />

      <KeyboardAvoider>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>{t("vehicle.verificationStatusLabel")}</Text>
          <VerifiedBadge verified={rcVerified} size="sm" />
        </View>
        {!rcVerified && (
          <Pressable onPress={() => navigation.navigate("VerifyDriver")}>
            <Text style={styles.getVerifiedLink}>{t("vehicle.getVerifiedLink")}</Text>
          </Pressable>
        )}

        <Text style={styles.label}>{t("vehicle.make")}</Text>
        <TextInput
          style={[styles.input, errors.make && styles.inputError]}
          value={make}
          onChangeText={(v) => { setMake(v); if (errors.make) setErrors((e) => ({ ...e, make: "" })); }}
        />
        <FieldError message={errors.make} />

        <Text style={styles.label}>{t("vehicle.model")}</Text>
        <TextInput
          style={[styles.input, errors.model && styles.inputError]}
          value={model}
          onChangeText={(v) => { setModel(v); if (errors.model) setErrors((e) => ({ ...e, model: "" })); }}
        />
        <FieldError message={errors.model} />

        <Text style={styles.label}>{t("vehicle.registrationNumber")}</Text>
        <TextInput
          style={[styles.input, errors.regNumber && styles.inputError]}
          autoCapitalize="characters"
          value={regNumber}
          onChangeText={(v) => { setRegNumber(v); if (errors.regNumber) setErrors((e) => ({ ...e, regNumber: "" })); }}
        />
        <FieldError message={errors.regNumber} />

        <Text style={styles.label}>{t("vehicle.color")}</Text>
        <TextInput style={styles.input} value={color} onChangeText={setColor} />

        <Text style={styles.label}>{t("vehicle.seats")}</Text>
        <View style={styles.chipRow}>
          {SEAT_OPTIONS.map((n) => (
            <Pressable
              key={n}
              style={[styles.seatChip, seatCapacity === n && styles.seatChipActive]}
              onPress={() => setSeatCapacity(n)}
            >
              <Text style={[styles.seatChipText, seatCapacity === n && styles.seatChipTextActive]}>{t("vehicle.seaterSuffix", { n })}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.button} onPress={handleSave} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? t("vehicle.uploadingAndSaving") : t("vehicle.saveVehicle")}</Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, height: 44, paddingHorizontal: spacing.md, color: colors.textPrimary },
  inputError: { borderColor: colors.danger },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  seatChip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  seatChipActive: { backgroundColor: colors.successBg, borderColor: colors.success },
  seatChipText: { ...typography.caption, color: colors.textSecondary },
  seatChipTextActive: { color: colors.success, fontWeight: "700", fontFamily: FONT.bold },
  button: { backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  buttonText: { ...typography.title, color: "#FFFFFF" },
  statusRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.xs,
  },
  statusLabel: { ...typography.caption, color: colors.textSecondary },
  getVerifiedLink: { ...typography.small, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold, marginBottom: spacing.sm },
});
