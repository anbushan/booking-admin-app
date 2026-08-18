import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Pressable } from "./Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { validateRidePricing } from "../lib/validators";
import { computeFareCap } from "../lib/fareCap";
import { formatInr } from "../lib/money";
import { FieldError } from "./FieldError";
import { SkeletonBlock } from "./Skeleton";
import SearchOptionsModal, { formatSearchDate } from "./SearchOptionsModal";
import { useTranslation } from "../lib/i18n/I18nContext";
import { PREFERENCE_OPTIONS } from "../lib/ridePreferences";
import { appEvents } from "../lib/appEvents";

// The entire "offer a ride" flow, formerly its own OfferRideScreen —
// moved inline onto Home's driver panel (see HomeScreenContent) so a
// driver never has to navigate away to publish a ride. Kept as its own
// component rather than inlined into HomeScreen.tsx directly: it owns a
// genuinely separate cluster of state (vehicles, recurring-ride toggle,
// preferences, pricing) that has nothing to do with the rest of Home,
// and this keeps that boundary explicit instead of dumping another
// dozen useState calls into an already-large screen component.
//
// Only requires `navigation` — same as the screen it replaced needed
// for openLocationSearch/RouteOptions, nothing about being embedded
// changes that contract.

// 0=Sun..6=Sat, matching the backend's daysOfWeek exactly. Mon-Fri —
// the "Weekdays" quick-preset most commute-recurring rides actually want.
const WEEKDAY_KEYS = [1, 2, 3, 4, 5];
const DAY_LABEL_KEYS = ["searchOptions.day0", "searchOptions.day1", "searchOptions.day2", "searchOptions.day3", "searchOptions.day4", "searchOptions.day5", "searchOptions.day6"];

type EndOption = "2w" | "1m" | "3m" | "none";
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

type Point = { lat: number; lng: number; address: string };

export function OfferRideForm({ navigation }: { navigation: any }) {
  const { t } = useTranslation();
  const [source, setSource] = useState<Point | null>(null);
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
  // single Ride when on (see handleContinue's `recurrence` param and
  // RouteOptionsScreen's branch on it). Start date is always "today" for
  // v1 — the existing `travelDate` chip above still supplies the
  // time-of-day, just reinterpreted as a daily departure time.
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

  // Every vehicle counts now, regardless of status — verification is a
  // trust badge shown to passengers, not a publish gate.
  function loadVehicles() {
    api.getVehicles()
      .then((list) => {
        setVehicles(list);
        if (list.length === 1) setVehicleId((prev) => prev ?? list[0].id);
        setVehiclesError(false);
      })
      .catch(() => setVehiclesError(true));
  }

  // Refetches every time Home regains focus, not just once on mount —
  // this form no longer has its own pull-to-refresh (nesting one inside
  // Home's own outer ScrollView would mean two competing pull gestures),
  // so a driver who goes off to DriverOnboarding to add a first vehicle
  // and comes back needs this to pick it up instead of still seeing the
  // stale "add a vehicle to publish" empty state.
  useFocusEffect(useCallback(() => { loadVehicles(); }, []));

  // Real GPS fix for "from" on mount — same pattern as Home's own
  // passenger search fields. Silent no-op on denial/failure.
  useEffect(() => {
    let cancelled = false;
    api.getCurrentLocation()
      .then((loc: Point) => { if (!cancelled) setSource((prev) => prev ?? loc); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // "offerRide-source"/"offerRide-destination" scope this listener to
  // picks meant for this form specifically, distinct from Home's own
  // passenger "home-source"/"home-destination" keys — both can be
  // mounted at the same time only in the sense that the listeners
  // exist together, but only one role's fields are ever actually on
  // screen at once.
  useEffect(() => {
    return appEvents.on("location:selected", (payload: { selectFor: string; location: Point }) => {
      if (payload.selectFor === "offerRide-source") setSource(payload.location);
      else if (payload.selectFor === "offerRide-destination") setDestination(payload.location);
    });
  }, []);

  // The backend rejects pricePerSeat above a per-km cap (cost-sharing vs.
  // commercial-fare rule) — computed here too so the driver sees the
  // real constraint for their actual route up front.
  const fareCap = source && destination
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
  // always shows the driver a choice of routes before the ride actually
  // gets created.
  function handleContinue() {
    if (!source) {
      openLocationSearch("offerRide-source");
      return;
    }
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
      validationErrors.price = t("offerRide.priceCapError", { cap: formatInr(fareCap) });
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

  if (vehicles === null && !vehiclesError) {
    // Shaped like the real form below (route card, date/seats row,
    // price field, preference chips, submit button) instead of a
    // generic spinner — so the vehicle-load beat doesn't cut to a
    // completely different-looking placeholder and then jump-cut again
    // to the actual form the instant it resolves.
    return (
      <View>
        <View style={styles.routeCard}>
          <View style={styles.field}>
            <SkeletonBlock style={styles.skeletonDot} />
            <SkeletonBlock style={styles.skeletonFieldText} />
          </View>
          <View style={[styles.field, { borderBottomWidth: 0 }]}>
            <SkeletonBlock style={styles.skeletonDot} />
            <SkeletonBlock style={[styles.skeletonFieldText, { width: "45%" }]} />
          </View>
        </View>

        <View style={styles.row}>
          <SkeletonBlock style={styles.skeletonLabel} />
          <SkeletonBlock style={styles.skeletonChip} />
        </View>
        <View style={styles.row}>
          <SkeletonBlock style={styles.skeletonLabel} />
          <SkeletonBlock style={[styles.skeletonChip, { width: 44 }]} />
        </View>

        <SkeletonBlock style={[styles.skeletonLabel, { marginTop: spacing.md }]} />
        <SkeletonBlock style={styles.skeletonInput} />

        <SkeletonBlock style={[styles.skeletonLabel, { marginTop: spacing.lg }]} />
        <View style={styles.chipRow}>
          <SkeletonBlock style={styles.skeletonPrefChip} />
          <SkeletonBlock style={styles.skeletonPrefChip} />
          <SkeletonBlock style={[styles.skeletonPrefChip, { width: 70 }]} />
        </View>

        <SkeletonBlock style={styles.skeletonButton} />
      </View>
    );
  }

  if (vehicles !== null && vehicles.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.noVehicleTitle}>{t("offerRide.addVehicleToPublish")}</Text>
        <Text style={styles.noVehicleSubtitle}>{t("offerRide.addVehicleSubtitle")}</Text>
        <Pressable style={styles.button} onPress={() => navigation.navigate("DriverOnboarding")}>
          <Text style={styles.buttonText}>{t("vehicle.addVehicle")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      {/* Shown whenever there's at least one vehicle, not just when
          there's a real choice to make (>1) — with only one vehicle,
          this used to skip straight past the label entirely, silently
          auto-selecting it with nothing on screen confirming which
          vehicle the ride would actually publish under. Now it always
          shows, just as a single already-active chip when there's
          nothing else to switch to. */}
      {vehicles && vehicles.length > 0 && (
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
          <Text style={[styles.fieldText, !source && { color: colors.textMuted }]}>
            {source?.address || t("home.whereFrom")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.field, { borderBottomWidth: 0 }]}
          onPress={() => openLocationSearch("offerRide-destination")}
        >
          <View style={[styles.dot, { backgroundColor: colors.marigold }]} />
          <Text style={[styles.fieldText, !destination && { color: colors.textMuted }]}>
            {destination?.address || t("home.whereTo")}
          </Text>
        </Pressable>
        {/* Always shown (BlaBlaCar-style), not just once both fields
            happen to be filled — a GPS fix that never resolves (denied
            permission, poor signal) shouldn't also hide the one control
            that lets a driver fix a wrong pick by swapping instead of
            re-typing both fields from scratch. Swapping a null with a
            set value just moves the address to the other field. */}
        <Pressable
          style={styles.swapButton}
          onPress={() => { const s = source; setSource(destination); setDestination(s); }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("home.swapLocations")}
        >
          <Ionicons name="swap-vertical" size={16} color={colors.accentText} />
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
          ? t("offerRide.priceCapHint", { cap: formatInr(fareCap) })
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  skeletonDot: { width: 8, height: 8, borderRadius: 4 },
  skeletonFieldText: { width: "70%", height: 14, borderRadius: 4 },
  skeletonLabel: { width: 70, height: 11, borderRadius: 4 },
  skeletonChip: { width: 110, height: 30, borderRadius: radius.sm },
  skeletonInput: { height: 44, borderRadius: radius.sm, marginTop: spacing.xs },
  skeletonPrefChip: { width: 90, height: 30, borderRadius: radius.sm },
  skeletonButton: { height: 46, borderRadius: radius.sm, marginTop: spacing.xl },
  noVehicleTitle: { ...typography.title, fontSize: 16, textAlign: "center" },
  noVehicleSubtitle: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
  routeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    position: "relative",
  },
  swapButton: {
    position: "absolute",
    right: spacing.md,
    top: "50%",
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
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
