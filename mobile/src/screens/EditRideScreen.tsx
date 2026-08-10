import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { validateRidePricing } from "../lib/validators";
import { computeFareCap } from "../lib/fareCap";
import { FieldError } from "../components/FieldError";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";

export default function EditRideScreen({ route, navigation }: any) {
  useScreenView("EditRideScreen");
  const { ride } = route.params;
  const [seats, setSeats] = useState(String(ride.seatsAvailable));
  const [price, setPrice] = useState(String(ride.pricePerSeat));
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Same fare cap the backend enforces (cost-sharing vs. commercial-fare
  // rule) — shown up front so a rejected save doesn't look like the
  // validation is just arbitrarily blocking a reasonable price.
  const fareCap = computeFareCap(ride.sourceLat, ride.sourceLng, ride.destLat, ride.destLng);
  const priceExceedsCap = Number(price) > fareCap;

  async function handleSave() {
    const validationErrors = validateRidePricing({ seats, price });
    if (priceExceedsCap) {
      validationErrors.price = `Price per seat can't exceed Rs ${fareCap} for this distance.`;
    }
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      await api.updateRide(ride.id, {
        seatsAvailable: Number(seats),
        pricePerSeat: Number(price),
      });
      navigation.goBack();
    } catch (err: any) {
      showAlert("Couldn't save", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    showAlert("Cancel this ride?", "Any confirmed passengers will be notified and refunded if already charged.", [
      { text: "Keep ride", style: "cancel" },
      {
        text: "Cancel ride",
        style: "destructive",
        onPress: async () => {
          await api.deleteRide(ride.id);
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title="Edit ride" onBack={() => navigation.goBack()} />

      <KeyboardAvoider>
      <View style={styles.body}>
        <Text style={styles.routeLabel}>{ride.sourceAddress} to {ride.destAddress}</Text>

        <Text style={styles.label}>Seats available</Text>
        <TextInput
          style={[styles.input, errors.seats && styles.inputError]}
          keyboardType="number-pad"
          value={seats}
          onChangeText={(v) => { setSeats(v); if (errors.seats) setErrors((e) => ({ ...e, seats: "" })); }}
        />
        <FieldError message={errors.seats} />

        <Text style={styles.label}>Price per seat</Text>
        <TextInput
          style={[styles.input, errors.price && styles.inputError]}
          keyboardType="number-pad"
          value={price}
          onChangeText={(v) => { setPrice(v); if (errors.price) setErrors((e) => ({ ...e, price: "" })); }}
        />
        <FieldError message={errors.price} />
        <Text style={[styles.hint, priceExceedsCap && { color: colors.danger }]}>
          Up to Rs {fareCap} per seat for this distance (cost-sharing cap)
        </Text>

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={submitting}>
          <Text style={styles.saveButtonText}>{submitting ? "Saving..." : "Save changes"}</Text>
        </Pressable>

        <Pressable style={styles.cancelRideButton} onPress={handleCancel}>
          <Text style={styles.cancelRideButtonText}>Cancel this ride</Text>
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
  routeLabel: { ...typography.title, fontSize: 14, marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, height: 44, paddingHorizontal: spacing.md, color: colors.textPrimary },
  inputError: { borderColor: colors.danger },
  hint: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
  saveButton: { backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  saveButtonText: { ...typography.title, color: "#FFFFFF" },
  cancelRideButton: { alignItems: "center", marginTop: spacing.lg },
  cancelRideButtonText: { ...typography.caption, color: colors.danger },
});
