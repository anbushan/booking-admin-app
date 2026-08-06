import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { validateRidePricing } from "../lib/validators";
import { computeFareCap } from "../lib/fareCap";
import { FieldError } from "../components/FieldError";
import SearchOptionsModal, { formatSearchDate } from "../components/SearchOptionsModal";
import { SafeAreaView } from "react-native-safe-area-context";

const PREFERENCE_OPTIONS = [
  { key: "music", label: "Music ok" },
  { key: "pets", label: "Pets ok" },
  { key: "smoking", label: "No smoking", inverted: true },
];

type Point = { lat: number; lng: number; address: string };

const DEFAULT_SOURCE: Point = { lat: 12.9352, lng: 77.6146, address: "Koramangala, Bengaluru" };

export default function OfferRideScreen({ navigation }: any) {
  const [source, setSource] = useState<Point>(DEFAULT_SOURCE);
  const [destination, setDestination] = useState<Point | null>(null);
  const [travelDate, setTravelDate] = useState(() => {
    const d = new Date();
    d.setHours(18, 30, 0, 0);
    return d;
  });
  const [seats, setSeats] = useState(3);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [price, setPrice] = useState("320");
  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    music: true,
    pets: true,
    smoking: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The backend rejects pricePerSeat above a per-km cap (cost-sharing vs.
  // commercial-fare rule) — computed here too so the driver sees the real
  // constraint for their actual route up front, instead of only finding
  // out after a rejected submit. A short route can have a cap well below
  // any flat default price.
  const fareCap = destination
    ? computeFareCap(source.lat, source.lng, destination.lat, destination.lng)
    : null;
  const priceExceedsCap = fareCap !== null && Number(price) > fareCap;

  function togglePreference(key: string) {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openLocationSearch(onSelect: (loc: Point) => void) {
    navigation.navigate("LocationSearch", { onSelect, skipMapConfirm: true });
  }

  async function handlePublish() {
    if (!destination) {
      showAlert("Add a destination", "Pick where this ride is headed before publishing.");
      return;
    }
    const validationErrors = validateRidePricing({ seats: String(seats), price });
    if (priceExceedsCap) {
      validationErrors.price = `Price per seat can't exceed Rs ${fareCap} for this distance.`;
    }
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      const ride = await api.createRide({
        sourceLat: source.lat, sourceLng: source.lng, sourceAddress: source.address,
        destLat: destination.lat, destLng: destination.lng, destAddress: destination.address,
        travelDate: travelDate.toISOString(),
        seatsAvailable: seats,
        pricePerSeat: Number(price),
        preferences,
      });
      Analytics.ridePublished(ride?.id || "");
      showAlert("Ride published", "Passengers can now find and book your ride.");
      // "Your rides" (History, driver view) — where the driver also sees
      // and responds to booking requests on this ride once they come in.
      navigation.navigate("History", { role: "DRIVER" });
    } catch (err: any) {
      showAlert("Couldn't publish ride", err.message);
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
        <Text style={styles.title}>Offer a ride</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.routeCard}>
          <Pressable style={styles.field} onPress={() => openLocationSearch(setSource)}>
            <View style={[styles.dot, { backgroundColor: colors.accent }]} />
            <Text style={styles.fieldText}>{source.address}</Text>
          </Pressable>
          <Pressable
            style={[styles.field, { borderBottomWidth: 0 }]}
            onPress={() => openLocationSearch(setDestination)}
          >
            <View style={[styles.dot, { backgroundColor: colors.danger }]} />
            <Text style={[styles.fieldText, !destination && { color: colors.textMuted }]}>
              {destination?.address || "Where to?"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Departure</Text>
          <Pressable style={styles.chip} onPress={() => setOptionsVisible(true)}>
            <Text style={styles.chipText}>{formatSearchDate(travelDate)}</Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Seats available</Text>
          <Pressable style={styles.chip} onPress={() => setOptionsVisible(true)}>
            <Text style={styles.chipText}>{seats}</Text>
          </Pressable>
        </View>
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
          {fareCap !== null
            ? `Up to Rs ${fareCap} per seat for this distance (cost-sharing cap)`
            : "Pick a destination to see the price cap for this route"}
        </Text>

        <Text style={[styles.label, { marginTop: spacing.lg }]}>Preferences</Text>
        <View style={styles.chipRow}>
          {PREFERENCE_OPTIONS.map((opt) => {
            const active = opt.inverted ? !preferences[opt.key] : preferences[opt.key];
            return (
              <Pressable
                key={opt.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => togglePreference(opt.key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.button} onPress={handlePublish} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? "Publishing..." : "Publish ride"}</Text>
        </Pressable>
      </View>

      <SearchOptionsModal
        visible={optionsVisible}
        initialDate={travelDate}
        initialSeats={seats}
        onClose={() => setOptionsVisible(false)}
        onConfirm={(date, newSeats) => {
          setTravelDate(date);
          setSeats(newSeats);
          setOptionsVisible(false);
          if (errors.seats) setErrors((e) => ({ ...e, seats: "" }));
        }}
      />
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
  routeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  fieldText: typography.body,
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
  label: { ...typography.caption, color: colors.textSecondary },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  hint: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
  inputError: { borderColor: colors.danger },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chipActive: { backgroundColor: colors.successBg, borderColor: colors.success },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextActive: { color: colors.success },
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
