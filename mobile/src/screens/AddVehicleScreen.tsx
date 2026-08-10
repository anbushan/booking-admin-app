import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { validateVehicle } from "../lib/validators";
import { FieldError } from "../components/FieldError";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { BackHeader } from "../components/BackHeader";

// Two-wheeler and auto are placeholders for now — UI-only, no backend
// field yet. Only "car" is selectable until that's built out.
const VEHICLE_TYPES = [
  { key: "car", label: "Car", icon: "car-sport-outline" as const },
  { key: "two_wheeler", label: "Two-wheeler", icon: "bicycle-outline" as const, comingSoon: true },
  { key: "auto", label: "Auto", icon: "cube-outline" as const, comingSoon: true },
];
const SEAT_OPTIONS = [4, 5, 6, 7];

export default function AddVehicleScreen({ navigation }: any) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [color, setColor] = useState("");
  const [seatCapacity, setSeatCapacity] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    const validationErrors = validateVehicle({ make, model, regNumber });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      await api.addVehicle({ make, model, regNumber: regNumber.toUpperCase(), color, seatCapacity });
      Analytics.vehicleAdded();
      navigation.navigate("OfferRide");
    } catch (err: any) {
      showAlert("Couldn't save vehicle", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title="Add your vehicle" onBack={() => navigation.goBack()} />

      <KeyboardAvoider>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Vehicle type</Text>
        <View style={styles.chipRow}>
          {VEHICLE_TYPES.map((t) => (
            <View key={t.key} style={[styles.typeChip, t.key === "car" && styles.typeChipActive, t.comingSoon && styles.typeChipDisabled]}>
              <Ionicons name={t.icon} size={16} color={t.key === "car" ? colors.success : colors.textSecondary} />
              <Text style={[styles.typeChipText, t.key === "car" && styles.typeChipTextActive]}>{t.label}</Text>
              {t.comingSoon && <Text style={styles.comingSoonBadge}>Coming soon</Text>}
            </View>
          ))}
        </View>

        <Text style={styles.label}>Make</Text>
        <TextInput
          style={[styles.input, errors.make && styles.inputError]}
          placeholder="Maruti"
          value={make}
          onChangeText={(v) => { setMake(v); if (errors.make) setErrors((e) => ({ ...e, make: "" })); }}
        />
        <FieldError message={errors.make} />

        <Text style={styles.label}>Model</Text>
        <TextInput
          style={[styles.input, errors.model && styles.inputError]}
          placeholder="Swift Dzire"
          value={model}
          onChangeText={(v) => { setModel(v); if (errors.model) setErrors((e) => ({ ...e, model: "" })); }}
        />
        <FieldError message={errors.model} />

        <Text style={styles.label}>Registration number</Text>
        <TextInput
          style={[styles.input, errors.regNumber && styles.inputError]}
          placeholder="TN09AB1234"
          autoCapitalize="characters"
          value={regNumber}
          onChangeText={(v) => { setRegNumber(v); if (errors.regNumber) setErrors((e) => ({ ...e, regNumber: "" })); }}
        />
        <FieldError message={errors.regNumber} />

        <Text style={styles.label}>Color (optional)</Text>
        <TextInput style={styles.input} placeholder="White" value={color} onChangeText={setColor} />

        <Text style={styles.label}>Seats</Text>
        <View style={styles.chipRow}>
          {SEAT_OPTIONS.map((n) => (
            <Pressable
              key={n}
              style={[styles.seatChip, seatCapacity === n && styles.typeChipActive]}
              onPress={() => setSeatCapacity(n)}
            >
              <Text style={[styles.typeChipText, seatCapacity === n && styles.typeChipTextActive]}>{n}-seater</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? "Saving..." : "Save vehicle"}</Text>
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
  typeChipTextActive: { color: colors.success, fontWeight: "700" },
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
    marginTop: spacing.xl,
  },
  buttonText: { ...typography.title, color: "#FFFFFF" },
});
