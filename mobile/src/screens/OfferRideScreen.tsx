import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { validateRidePricing } from "../lib/validators";
import { computeFareCap } from "../lib/fareCap";
import { FieldError } from "../components/FieldError";
import { CarLoader } from "../components/CarLoader";
import SearchOptionsModal, { formatSearchDate } from "../components/SearchOptionsModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

const PREFERENCE_OPTIONS = [
  { key: "music", labelKey: "offerRide.musicOk" },
  { key: "pets", labelKey: "offerRide.petsOk" },
  { key: "smoking", labelKey: "offerRide.noSmoking", inverted: true },
];

type Point = { lat: number; lng: number; address: string };

const DEFAULT_SOURCE: Point = { lat: 12.9352, lng: 77.6146, address: "Koramangala, Bengaluru" };

export default function OfferRideScreen({ navigation }: any) {
  useScreenView("OfferRideScreen");
  const { t } = useTranslation();
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
  const [refreshing, setRefreshing] = useState(false);

  // Every vehicle counts now, regardless of status — verification is a
  // trust badge shown to passengers (VerifiedBadge/VerifyDriverScreen),
  // not a publish gate (rides.routes.js dropped its own APPROVED-only
  // block for the same reason). This used to filter down to APPROVED
  // only and show a "waiting on admin review" empty state otherwise,
  // which left a driver with a brand-new (or Eko-verified but never
  // manually-reviewed) vehicle unable to publish anything at all.
  function loadVehicles(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    api.getVehicles()
      .then((list) => {
        setVehicles(list);
        if (list.length === 1) setVehicleId(list[0].id);
        setVehiclesError(false);
      })
      .catch(() => setVehiclesError(true))
      .finally(() => setRefreshing(false));
  }

  useEffect(() => {
    loadVehicles();
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
      showAlert(t("offerRide.addDestinationTitle"), t("offerRide.addDestinationBody"));
      return;
    }
    if (vehicles && vehicles.length > 1 && !vehicleId) {
      showAlert(t("offerRide.selectVehicleTitle"), t("offerRide.selectVehicleBody"));
      return;
    }
    const validationErrors = validateRidePricing({ seats: String(seats), price }, t);
    if (priceExceedsCap) {
      validationErrors.price = t("offerRide.priceCapError", { cap: fareCap });
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
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>{t("offerRide.title")}</Text>

      {vehicles === null && !vehiclesError ? (
        <View style={styles.centerState}>
          <CarLoader />
        </View>
      ) : vehicles !== null && vehicles.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.centerState}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadVehicles(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        >
          <Text style={styles.noVehicleTitle}>{t("offerRide.addVehicleToPublish")}</Text>
          <Text style={styles.noVehicleSubtitle}>{t("offerRide.addVehicleSubtitle")}</Text>
          <Pressable style={styles.button} onPress={() => navigation.navigate("DriverOnboarding")}>
            <Text style={styles.buttonText}>{t("vehicle.addVehicle")}</Text>
          </Pressable>
        </ScrollView>
      ) : (
      <KeyboardAvoider>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {vehicles && vehicles.length > 1 && (
          <>
            <Text style={styles.label}>{t("offerRide.vehicle")}</Text>
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
              {destination?.address || t("home.whereTo")}
            </Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>{t("offerRide.departure")}</Text>
          <Pressable style={styles.chip} onPress={() => setOptionsVisible(true)}>
            <Text style={styles.chipText}>{formatSearchDate(travelDate, t)}</Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>{t("offerRide.seatsAvailable")}</Text>
          <Pressable style={styles.chip} onPress={() => setOptionsVisible(true)}>
            <Text style={styles.chipText}>{seats}</Text>
          </Pressable>
        </View>
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
          {fareCap !== null
            ? t("offerRide.priceCapHint", { cap: fareCap })
            : t("offerRide.pickDestinationHint")}
        </Text>

        <Text style={[styles.label, { marginTop: spacing.lg }]}>{t("offerRide.preferences")}</Text>
        <View style={styles.chipRow}>
          {PREFERENCE_OPTIONS.map((opt) => {
            const active = opt.inverted ? !preferences[opt.key] : preferences[opt.key];
            return (
              <Pressable
                key={opt.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => togglePreference(opt.key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(opt.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>{t("offerRide.searchRoutes")}</Text>
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
  // Used both as a plain View style (the initial loading spinner) and
  // as a ScrollView's contentContainerStyle (the two empty states,
  // now pull-to-refreshable) — flexGrow alongside flex covers both:
  // a ScrollView's content container needs flexGrow (not just flex)
  // to actually fill and center short content instead of collapsing
  // to its own height.
  centerState: { flex: 1, flexGrow: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
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
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  buttonText: { ...typography.title, color: "#FFFFFF" },
});
