import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { validateVehicle } from "../lib/validators";
import { FieldError } from "../components/FieldError";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { BackHeader } from "../components/BackHeader";

const SEAT_OPTIONS = [4, 5, 6, 7];

export default function EditVehicleScreen({ route, navigation }: any) {
  const { vehicle } = route.params;
  const [make, setMake] = useState(vehicle.make);
  const [model, setModel] = useState(vehicle.model);
  const [regNumber, setRegNumber] = useState(vehicle.regNumber);
  const [color, setColor] = useState(vehicle.color || "");
  const [seatCapacity, setSeatCapacity] = useState(vehicle.seatCapacity || 4);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSave() {
    const validationErrors = validateVehicle({ make, model, regNumber });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      await api.updateVehicle(vehicle.id, { make, model, regNumber: regNumber.toUpperCase(), color, seatCapacity });
      navigation.goBack();
    } catch (err: any) {
      showAlert("Couldn't save", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title="Edit vehicle" onBack={() => navigation.goBack()} />

      <KeyboardAvoider>
      <View style={styles.body}>
        <Text style={styles.label}>Make</Text>
        <TextInput
          style={[styles.input, errors.make && styles.inputError]}
          value={make}
          onChangeText={(v) => { setMake(v); if (errors.make) setErrors((e) => ({ ...e, make: "" })); }}
        />
        <FieldError message={errors.make} />

        <Text style={styles.label}>Model</Text>
        <TextInput
          style={[styles.input, errors.model && styles.inputError]}
          value={model}
          onChangeText={(v) => { setModel(v); if (errors.model) setErrors((e) => ({ ...e, model: "" })); }}
        />
        <FieldError message={errors.model} />

        <Text style={styles.label}>Registration number</Text>
        <TextInput
          style={[styles.input, errors.regNumber && styles.inputError]}
          autoCapitalize="characters"
          value={regNumber}
          onChangeText={(v) => { setRegNumber(v); if (errors.regNumber) setErrors((e) => ({ ...e, regNumber: "" })); }}
        />
        <FieldError message={errors.regNumber} />

        <Text style={styles.label}>Color</Text>
        <TextInput style={styles.input} value={color} onChangeText={setColor} />

        <Text style={styles.label}>Seats</Text>
        <View style={styles.chipRow}>
          {SEAT_OPTIONS.map((n) => (
            <Pressable
              key={n}
              style={[styles.seatChip, seatCapacity === n && styles.seatChipActive]}
              onPress={() => setSeatCapacity(n)}
            >
              <Text style={[styles.seatChipText, seatCapacity === n && styles.seatChipTextActive]}>{n}-seater</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.button} onPress={handleSave} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? "Saving..." : "Save vehicle"}</Text>
        </Pressable>
      </View>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  back: { fontSize: 18 },
  title: typography.title,
  body: { padding: spacing.lg },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, height: 44, paddingHorizontal: spacing.md, color: colors.textPrimary },
  inputError: { borderColor: colors.danger },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  seatChip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  seatChipActive: { backgroundColor: colors.successBg, borderColor: colors.success },
  seatChipText: { ...typography.caption, color: colors.textSecondary },
  seatChipTextActive: { color: colors.success, fontWeight: "700" },
  button: { backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  buttonText: { color: "#FFFFFF", ...typography.title },
});
