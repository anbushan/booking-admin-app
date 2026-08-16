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
import { PREFERENCE_OPTIONS } from "../lib/ridePreferences";
import { appEvents } from "../lib/appEvents";

// 0=Sun..6=Sat, matching the backend's daysOfWeek exactly. Mon-Fri —
// the "Weekdays" quick-preset most commute-recurring rides actually want.
const WEEKDAY_KEYS = [1, 2, 3, 4, 5];
const DAY_LABEL_KEYS = ["searchOptions.day0", "searchOptions.day1", "searchOptions.day2", "searchOptions.day3", "searchOptions.day4", "searchOptions.day5", "searchOptions.day6"];

type EndOption = "2w" | "1m" | "3m" | "none";
// Literal key per option (not constructed via template string) — this
// app's i18n never builds a key dynamically, always a direct t("...")
// reference, so cross-checking every real usage against en.json (the
// workflow every screen's i18n pass has followed all session) stays
// possible with a plain grep instead of having to reason about string
// interpolation.
const END_OPTIONS: { key: EndOption; labelKey: string }[] = [
  { key: "2w", labelKey: "offerRide.repeatUntilTwoWeeks" },
  { key: "1m", labelKey: "offerRide.repeatUntilOneMonth" },
  { key: "3m", labelKey: "offerRide.repeatUntilThreeMonths" },
  { key: "none", labelKey: "offerRide.repeatUntilNoEnd" },
];
function endDateFor(option: EndOption, from: Date): Date | null {
  if (option === "none") return null;
  const d = new Date(from);
  if (option === "2w") d.setDate(d.getDate() + 14);
  if (option === "1m") d.setMonth(d.getMonth() + 1);
  if (option === "3m") d.setMonth(d.getMonth() + 3);
  return d;
}

// See lib/ridePreferences.ts for why this lives there instead of here —
// RidePreferences.tsx (the read-only passenger-facing display in
// SearchResultsScreen/BookingConfirmScreen) needs this same list too,
// and a component reaching into a screen file for a constant is the
// wrong dependency direction.

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

  // "Repeat this ride" — publishes a RecurringRideTemplate instead of a
  // single Ride when on (see RouteOptionsScreen's branch on `recurrence`
  // params). Start date is always "today" for v1 (not its own picker —
  // one fewer decision for the common case, "starting now"); the
  // existing `travelDate` chip above still supplies the time-of-day,
  // just reinterpreted as a daily departure time instead of one date.
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>(WEEKDAY_KEYS);
  const [endOption, setEndOption] = useState<EndOption>("none");
  const [repeatDaysError, setRepeatDaysError] = useState("");

  function toggleRepeatDay(day: number) {
    setRepeatDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
    setRepeatDaysError("");
  }

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

  // See HomeScreen.tsx's identical listener for why this is an event
  // instead of a callback threaded through navigation params — React
  // Navigation warns on function values in route params (they break
  // state persistence/restoration). "offerRide-source"/
  // "offerRide-destination" scope this to picks meant for this screen.
  useEffect(() => {
    return appEvents.on("location:selected", (payload: { selectFor: string; location: Point }) => {
      if (payload.selectFor === "offerRide-source") setSource(payload.location);
      else if (payload.selectFor === "offerRide-destination") setDestination(payload.location);
    });
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

  function openLocationSearch(selectFor: "offerRide-source" | "offerRide-destination") {
    navigation.navigate("LocationSearch", { selectFor, skipMapConfirm: true });
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
    if (repeatEnabled && repeatDays.length === 0) {
      setRepeatDaysError(t("offerRide.pickAtLeastOneDay"));
    }
    if (Object.keys(validationErrors).length > 0 || (repeatEnabled && repeatDays.length === 0)) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const departureTime = `${String(travelDate.getHours()).padStart(2, "0")}:${String(travelDate.getMinutes()).padStart(2, "0")}`;
    const endDate = endDateFor(endOption, today);

    navigation.navigate("RouteOptions", {
      sourceLat: source.lat, sourceLng: source.lng, sourceAddress: source.address,
      destLat: destination.lat, destLng: destination.lng, destAddress: destination.address,
      // Still sent even in recurrence mode — RouteOptionsScreen's route-
      // alternatives fetch doesn't care which mode this is, only the
      // final create call (createRide vs createRecurringRide) branches.
      travelDate: travelDate.toISOString(),
      seatsAvailable: seats,
      pricePerSeat: Number(price),
      preferences,
      ...(vehicleId ? { vehicleId } : {}),
      ...(repeatEnabled ? {
        recurrence: {
          daysOfWeek: repeatDays,
          departureTime,
          startDate: today.toISOString(),
          ...(endDate ? { endDate: endDate.toISOString() } : {}),
        },
      } : {}),
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
          <Pressable style={styles.field} onPress={() => openLocationSearch("offerRide-source")}>
            <View style={[styles.dot, { backgroundColor: colors.accent }]} />
            <Text style={styles.fieldText}>{source.address}</Text>
          </Pressable>
          <Pressable
            style={[styles.field, { borderBottomWidth: 0 }]}
            onPress={() => openLocationSearch("offerRide-destination")}
          >
            <View style={[styles.dot, { backgroundColor: colors.danger }]} />
            <Text style={[styles.fieldText, !destination && { color: colors.textMuted }]}>
              {destination?.address || t("home.whereTo")}
            </Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>{repeatEnabled ? t("offerRide.departureTime") : t("offerRide.departure")}</Text>
          <Pressable style={styles.chip} onPress={() => setOptionsVisible(true)}>
            <Text style={styles.chipText}>
              {repeatEnabled ? formatSearchDate(travelDate, t).split(",").pop()!.trim() : formatSearchDate(travelDate, t)}
            </Text>
          </Pressable>
        </View>

        {/* "Repeat this ride" — publishes a recurring series instead of
            a single ride (see handleContinue's `recurrence` param and
            RouteOptionsScreen's branch on it). Same checkbox visual
            language as everywhere else this app has one (WhatsApp
            opt-in on OtpScreens, "Set as primary" on Add Emergency
            Contact). */}
        <Pressable
          style={styles.repeatToggleRow}
          onPress={() => setRepeatEnabled((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: repeatEnabled }}
          accessibilityLabel={t("offerRide.repeatThisRide")}
        >
          <View style={[styles.checkbox, repeatEnabled && styles.checkboxActive]}>
            {repeatEnabled && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.repeatToggleLabel}>{t("offerRide.repeatThisRide")}</Text>
            <Text style={styles.repeatToggleHint}>{t("offerRide.repeatThisRideHint")}</Text>
          </View>
        </Pressable>

        {repeatEnabled && (
          <View style={styles.repeatSection}>
            <View style={styles.repeatDaysHeaderRow}>
              <Text style={styles.label}>{t("offerRide.repeatsOn")}</Text>
              <Pressable onPress={() => { setRepeatDays(WEEKDAY_KEYS); setRepeatDaysError(""); }}>
                <Text style={styles.weekdaysPresetLink}>{t("offerRide.weekdaysPreset")}</Text>
              </Pressable>
            </View>
            <View style={styles.chipRow}>
              {DAY_LABEL_KEYS.map((key, day) => {
                const active = repeatDays.includes(day);
                return (
                  <Pressable
                    key={day}
                    style={[styles.dayChip, active && styles.chipActive]}
                    onPress={() => toggleRepeatDay(day)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(key)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <FieldError message={repeatDaysError} />

            <Text style={[styles.label, { marginTop: spacing.md }]}>{t("offerRide.repeatUntil")}</Text>
            <View style={styles.chipRow}>
              {END_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[styles.chip, endOption === opt.key && styles.chipActive]}
                  onPress={() => setEndOption(opt.key)}
                >
                  <Text style={[styles.chipText, endOption === opt.key && styles.chipTextActive]}>
                    {t(opt.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

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
  dayChip: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    width: 42, height: 36, alignItems: "center", justifyContent: "center",
  },
  repeatToggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
  },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  repeatToggleLabel: { ...typography.body, fontWeight: "700", fontFamily: FONT.bold },
  repeatToggleHint: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  repeatSection: {
    marginTop: spacing.sm, padding: spacing.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
  },
  repeatDaysHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weekdaysPresetLink: { ...typography.small, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold, textDecorationLine: "underline" },
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
