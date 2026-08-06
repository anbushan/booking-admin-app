import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { validateVehicle } from "../lib/validators";
import { FieldError } from "../components/FieldError";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddVehicleScreen({ navigation }: any) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [color, setColor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    const validationErrors = validateVehicle({ make, model, regNumber });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      await api.addVehicle({ make, model, regNumber: regNumber.toUpperCase(), color });
      Analytics.vehicleAdded();
      navigation.navigate("OfferRide");
    } catch (err: any) {
      showAlert("Couldn't save vehicle", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>Add your vehicle</Text>
      </View>

      <View style={styles.body}>
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

        <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? "Saving..." : "Save vehicle"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: { fontSize: 18 },
  title: typography.title,
  body: { padding: spacing.lg },
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
