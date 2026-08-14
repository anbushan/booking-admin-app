import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { validateVehicle } from "../lib/validators";
import { FieldError } from "../components/FieldError";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

// Two-wheeler and auto are placeholders for now — UI-only, no backend
// field yet. Only "car" is selectable until that's built out.
const VEHICLE_TYPES = [
  { key: "car", labelKey: "vehicle.car", icon: "car-sport-outline" as const },
  { key: "two_wheeler", labelKey: "vehicle.twoWheeler", icon: "bicycle-outline" as const, comingSoon: true },
  { key: "auto", labelKey: "vehicle.auto", icon: "cube-outline" as const, comingSoon: true },
];
const SEAT_OPTIONS = [4, 5, 6, 7];

export default function AddVehicleScreen({ navigation }: any) {
  useScreenView("AddVehicleScreen");
  const { t } = useTranslation();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [color, setColor] = useState("");
  const [seatCapacity, setSeatCapacity] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    const validationErrors = validateVehicle({ make, model, regNumber }, t);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      // No document upload here anymore — RC/license verification now
      // happens entirely through the paid Eko flow (VerifyDriverScreen,
      // reachable from VehicleList right after this), which stores
      // Eko's own response as the record of what was checked. Nothing
      // uploaded here to review manually against.
      await api.addVehicle({ make, model, regNumber: regNumber.toUpperCase(), color, seatCapacity });
      Analytics.vehicleAdded();
      // A new vehicle can publish rides immediately now (verification
      // is a trust badge, not a publish gate — see rides.routes.js) —
      // landing on the vehicle list is still right either way, since
      // that's also where the "get verified" entry point lives.
      navigation.navigate("VehicleList");
    } catch (err: any) {
      showAlert(t("vehicle.couldntSaveVehicle"), err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // This screen is reached two structurally different ways: pushed
  // normally on top of existing history (VehicleList's "+", OfferRide's
  // "add a vehicle to publish") — goBack() is correct there — or landed
  // on via a navigation.reset() with this as the ONLY entry (a brand-new
  // driver registration, see RegisterScreen; and SwitchRoleScreen's own
  // reset does the same the first time an existing account switches to
  // driver). A reset means there's nothing behind this screen to pop to
  // at all, so goBack() silently did nothing — the back arrow looked
  // like a dead button. canGoBack() is exactly the signal for which
  // case this is; when there's no history, SwitchRole is where this
  // step conceptually follows from either way (fresh registration or an
  // existing account setting up driver mode for the first time), so
  // that's the fallback destination instead of a no-op.
  const canGoBack = navigation.canGoBack();

  function handleBack() {
    if (canGoBack) {
      navigation.goBack();
    } else {
      navigation.reset({ index: 0, routes: [{ name: "SwitchRole" }] });
    }
  }

  function handleSkip() {
    navigation.reset({ index: 0, routes: [{ name: "Home" }] });
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader
        title={t("vehicle.addYourVehicle")}
        onBack={handleBack}
        // Skip only makes sense in the no-history (onboarding) case —
        // when this was pushed from VehicleList/OfferRide, the driver's
        // already past onboarding and mid-way through deliberately
        // adding a vehicle; a "skip to dashboard" affordance there would
        // yank them out of what they were just doing instead of letting
        // the back arrow (which already works correctly in that case)
        // do its normal job.
        right={
          !canGoBack ? (
            <Pressable onPress={handleSkip} hitSlop={8}>
              <Text style={styles.skipText}>{t("vehicle.skipForNow")}</Text>
            </Pressable>
          ) : undefined
        }
      />

      <KeyboardAvoider>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{t("vehicle.vehicleType")}</Text>
        <View style={styles.chipRow}>
          {VEHICLE_TYPES.map((vt) => (
            <View key={vt.key} style={[styles.typeChip, vt.key === "car" && styles.typeChipActive, vt.comingSoon && styles.typeChipDisabled]}>
              <Ionicons name={vt.icon} size={16} color={vt.key === "car" ? colors.success : colors.textSecondary} />
              <Text style={[styles.typeChipText, vt.key === "car" && styles.typeChipTextActive]}>{t(vt.labelKey)}</Text>
              {vt.comingSoon && <Text style={styles.comingSoonBadge}>{t("vehicle.comingSoon")}</Text>}
            </View>
          ))}
        </View>

        <Text style={styles.label}>{t("vehicle.make")}</Text>
        <TextInput
          style={[styles.input, errors.make && styles.inputError]}
          placeholder="Maruti"
          placeholderTextColor={colors.textMuted}
          value={make}
          onChangeText={(v) => { setMake(v); if (errors.make) setErrors((e) => ({ ...e, make: "" })); }}
        />
        <FieldError message={errors.make} />

        <Text style={styles.label}>{t("vehicle.model")}</Text>
        <TextInput
          style={[styles.input, errors.model && styles.inputError]}
          placeholder="Swift Dzire"
          placeholderTextColor={colors.textMuted}
          value={model}
          onChangeText={(v) => { setModel(v); if (errors.model) setErrors((e) => ({ ...e, model: "" })); }}
        />
        <FieldError message={errors.model} />

        <Text style={styles.label}>{t("vehicle.registrationNumber")}</Text>
        <TextInput
          style={[styles.input, errors.regNumber && styles.inputError]}
          placeholder="TN09AB1234"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          value={regNumber}
          onChangeText={(v) => { setRegNumber(v); if (errors.regNumber) setErrors((e) => ({ ...e, regNumber: "" })); }}
        />
        <FieldError message={errors.regNumber} />

        <Text style={styles.label}>{t("vehicle.colorOptional")}</Text>
        <TextInput style={styles.input} placeholder="White" placeholderTextColor={colors.textMuted} value={color} onChangeText={setColor} />

        <Text style={styles.label}>{t("vehicle.seats")}</Text>
        <View style={styles.chipRow}>
          {SEAT_OPTIONS.map((n) => (
            <Pressable
              key={n}
              style={[styles.seatChip, seatCapacity === n && styles.typeChipActive]}
              onPress={() => setSeatCapacity(n)}
            >
              <Text style={[styles.typeChipText, seatCapacity === n && styles.typeChipTextActive]}>{t("vehicle.seaterSuffix", { n })}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.docsHint}>{t("vehicle.docsHintAdd")}</Text>

        <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? t("vehicle.uploadingAndSaving") : t("vehicle.saveVehicle")}</Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  skipText: { ...typography.caption, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  body: { padding: spacing.lg },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  docsHint: { ...typography.small, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 16 },
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
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  typeChip: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    gap: 6,
  },
  typeChipActive: { backgroundColor: colors.successBg, borderColor: colors.success },
  typeChipDisabled: { opacity: 0.5 },
  typeChipText: { ...typography.caption, color: colors.textSecondary },
  typeChipTextActive: { color: colors.success, fontWeight: "700", fontFamily: FONT.bold },
  comingSoonBadge: { ...typography.small, color: colors.textMuted, marginTop: 2, fontSize: 10 },
  seatChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  button: {
    backgroundColor: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  buttonText: { ...typography.title, color: "#FFFFFF" },
});
