import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
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
import { useTranslation } from "../lib/i18n/I18nContext";

export default function EditRideScreen({ route, navigation }: any) {
  useScreenView("EditRideScreen");
  const { t } = useTranslation();
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
    const validationErrors = validateRidePricing({ seats, price }, t);
    if (priceExceedsCap) {
      validationErrors.price = t("offerRide.priceCapError", { cap: fareCap });
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
      showAlert(t("common.couldntSave"), err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    showAlert(t("history.cancelThisRide"), t("history.cancelRideConfirm"), [
      { text: t("history.keepRide"), style: "cancel" },
      {
        text: t("history.cancelRide"),
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteRide(ride.id);
            navigation.goBack();
          } catch (err: any) {
            // Most commonly hit when a passenger paid and locked in a
            // seat after this screen loaded — the backend's own error
            // message already explains that clearly (see rides.routes.js
            // DELETE /:id), so it's shown as-is rather than a generic
            // "couldn't cancel".
            showAlert(t("history.cancelPolicyTitle"), err.message || t("history.couldntCancel"));
          }
        },
      },
    ]);
  }

  // Same policy shown proactively via the info icon next to "Cancel this
  // ride" — see HistoryScreen's showCancelPolicy for the driver-list
  // equivalent. `ride.hasConfirmedBooking` is carried over from whatever
  // list this screen was opened from (History's own "Your rides"); if a
  // caller ever navigates here without it, this just shows the general
  // policy rather than the "already blocked" variant.
  function showCancelPolicy() {
    showAlert(
      t("history.cancelPolicyTitle"),
      ride.hasConfirmedBooking ? t("history.cancelPolicyBlocked") : t("history.cancelPolicyAvailable")
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("editRide.title")} onBack={() => navigation.goBack()} />

      <KeyboardAvoider>
      <View style={styles.body}>
        <Text style={styles.routeLabel}>{t("common.routeTo", { source: ride.sourceAddress, dest: ride.destAddress })}</Text>

        <Text style={styles.label}>{t("offerRide.seatsAvailable")}</Text>
        <TextInput
          style={[styles.input, errors.seats && styles.inputError]}
          keyboardType="number-pad"
          value={seats}
          onChangeText={(v) => { setSeats(v); if (errors.seats) setErrors((e) => ({ ...e, seats: "" })); }}
        />
        <FieldError message={errors.seats} />

        <Text style={styles.label}>{t("offerRide.pricePerSeat")}</Text>
        <TextInput
          style={[styles.input, errors.price && styles.inputError]}
          keyboardType="number-pad"
          value={price}
          onChangeText={(v) => { setPrice(v); if (errors.price) setErrors((e) => ({ ...e, price: "" })); }}
        />
        <FieldError message={errors.price} />
        <Text style={[styles.hint, priceExceedsCap && { color: colors.danger }]}>
          {t("offerRide.priceCapHint", { cap: fareCap })}
        </Text>

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={submitting}>
          <Text style={styles.saveButtonText}>{submitting ? t("register.saving") : t("editRide.saveChanges")}</Text>
        </Pressable>

        <View style={styles.cancelRideRow}>
          <Pressable style={styles.cancelRideButton} onPress={handleCancel}>
            <Text style={styles.cancelRideButtonText}>{t("editRide.cancelThisRideButton")}</Text>
          </Pressable>
          <Pressable style={styles.infoIconButton} onPress={showCancelPolicy} hitSlop={8}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
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
  cancelRideRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: spacing.lg },
  cancelRideButton: { alignItems: "center" },
  cancelRideButtonText: { ...typography.caption, color: colors.danger },
  infoIconButton: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
