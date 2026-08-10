import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { validateRidePricing } from "../lib/validators";
import { computeFareCap } from "../lib/fareCap";
import { FieldError } from "../components/FieldError";
import { CarLoader } from "../components/CarLoader";
import SearchOptionsModal, { formatSearchDate } from "../components/SearchOptionsModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";
import { KeyboardAvoider } from "../components/KeyboardAvoider";

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
    // A fixed "today at 18:30" default is in the past for a good chunk
    // of the day (anyone opening this after 6:30pm) — the backend
    // rejects any travelDate that isn't strictly in the future, so
    // publishing without touching the date picker at all would 400
    // with no obvious reason why. Roll forward to tomorrow instead of
    // just leaving it broken.
    const d = new Date();
    d.setHours(18, 30, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [vehicles, setVehicles] = useState<any[] | null>(null); // null = still loading
  const [vehiclesError, setVehiclesError] = useState(false);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    api.getVehicles()
      .then((list) => {
        setVehicles(list);
        if (list.length === 1) setVehicleId(list[0].id);
      })
      .catch(() => setVehiclesError(true));
    api.getMyProfile().then(setProfile).catch(() => {});
  }, []);

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

  // Doesn't publish directly — hands off to RouteOptionsScreen, which
  // always shows the driver a choice of routes (even for a plain
  // point-to-point trip) before the ride actually gets created. That
  // screen makes the real api.createRide() call once a route is picked.
  function handleContinue() {
    if (!destination) {
      showAlert("Add a destination", "Pick where this ride is headed before publishing.");
      return;
    }
    if (vehicles && vehicles.length > 1 && !vehicleId) {
      showAlert("Select a vehicle", "Choose which vehicle this ride uses before publishing.");
      return;
    }
    const validationErrors = validateRidePricing({ seats: String(seats), price });
    if (priceExceedsCap) {
      validationErrors.price = `Price per seat can't exceed Rs ${fareCap} for this distance.`;
    }
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    navigation.navigate("RouteOptions", {
      sourceLat: source.lat, sourceLng: source.lng, sourceAddress: source.address,
      destLat: destination.lat, destLng: destination.lng, destAddress: destination.address,
      travelDate: travelDate.toISOString(),
      seatsAvailable: seats,
      pricePerSeat: Number(price),
      preferences,
      ...(vehicleId ? { vehicleId } : {}),
    });
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>Offer a ride</Text>

      {vehicles === null && !vehiclesError ? (
        <View style={styles.centerState}>
          <CarLoader />
        </View>
      ) : vehicles !== null && vehicles.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.noVehicleTitle}>Add a vehicle to publish rides</Text>
          <Text style={styles.noVehicleSubtitle}>Passengers need to know what they're getting picked up in.</Text>
          <Pressable style={styles.button} onPress={() => navigation.navigate("AddVehicle")}>
            <Text style={styles.buttonText}>Add vehicle</Text>
          </Pressable>
        </View>
      ) : (
      <KeyboardAvoider>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {vehicles && vehicles.length > 1 && (
          <>
            <Text style={styles.label}>Vehicle</Text>
            <View style={styles.chipRow}>
              {vehicles.map((v) => (
                <Pressable
                  key={v.id}
                  style={[styles.chip, vehicleId === v.id && styles.chipActive]}
                  onPress={() => setVehicleId(v.id)}
                >
                  <Text style={[styles.chipText, vehicleId === v.id && styles.chipTextActive]}>
                    {v.make} {v.model} · {v.regNumber}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

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

        <Pressable style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Search routes</Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoider>
      )}

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
      <AppBottomNav navigation={navigation} profile={profile} active="offerRide" />
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
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  noVehicleTitle: { ...typography.title, fontSize: 16, textAlign: "center" },
  noVehicleSubtitle: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
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
    color: colors.textPrimary,
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
  buttonText: { ...typography.title, color: "#FFFFFF" },
});
