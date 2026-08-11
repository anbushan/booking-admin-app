import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, ScrollView, RefreshControl, Animated, Easing, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
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
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

const PREFERENCE_OPTIONS = [
  { key: "music", labelKey: "offerRide.musicOk" },
  { key: "pets", labelKey: "offerRide.petsOk" },
  { key: "smoking", labelKey: "offerRide.noSmoking", inverted: true },
];

type Point = { lat: number; lng: number; address: string };

const DEFAULT_SOURCE: Point = { lat: 12.9352, lng: 77.6146, address: "Koramangala, Bengaluru" };

const APPROVAL_FLOW_STEPS: { icon: keyof typeof Ionicons.glyphMap; labelKey: string }[] = [
  { icon: "add-circle-outline", labelKey: "vehicle.addVehicle" },
  { icon: "shield-checkmark-outline", labelKey: "offerRide.adminVerifies" },
  { icon: "checkmark-circle-outline", labelKey: "vehicle.approved" },
  { icon: "car-sport-outline", labelKey: "driver.offerRide" },
];

// Same idea as HomeScreen's passenger-side "Why ride with NanbaGO"
// widget — makes an otherwise-invisible backend process (a vehicle
// sitting PENDING until an admin looks at it) visible as a concrete,
// small number of steps — and the same order-tracking language
// StepTracker already uses for a booking's journey (a car literally
// sliding along the line to wherever things actually are right now,
// not just a static row of icons), just laid out horizontally instead
// of vertically since this is a compact card, not a full detail
// screen. currentStep is 1-indexed and marks the step just completed/
// in progress — sits literally between "Admin verifies" and "Approved"
// while a vehicle is PENDING (currentStep=2), not just colored done.
function VehicleApprovalFlow({ currentStep }: { currentStep: number }) {
  const { t } = useTranslation();
  const [stepCenters, setStepCenters] = useState<number[]>([]);
  const carX = useRef(new Animated.Value(0)).current;
  const activeIndex = currentStep - 1;

  function handleStepLayout(index: number, x: number, width: number) {
    setStepCenters((prev) => {
      const next = [...prev];
      next[index] = x + width / 2 - 12; // center the 24px car badge on the step
      return next;
    });
  }

  useEffect(() => {
    if (activeIndex < 0 || stepCenters.length !== APPROVAL_FLOW_STEPS.length || stepCenters.some((x) => x == null)) return;
    Animated.timing(carX, {
      toValue: stepCenters[activeIndex],
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, stepCenters.length, stepCenters[activeIndex]]);

  return (
    <View style={styles.flowCard}>
      <Text style={styles.flowTitle}>{t("offerRide.howThisWorks")}</Text>
      <View style={{ position: "relative" }}>
        {activeIndex >= 0 && stepCenters.length === APPROVAL_FLOW_STEPS.length && (
          <Animated.View style={[styles.flowCarBadge, { transform: [{ translateX: carX }] }]} pointerEvents="none">
            {/* car-sport faces left by default; this only ever moves
                rightward (steps progress left to right), so a
                permanent flip is enough — no direction-syncing needed
                like the bouncing loaders (CarLoader/LoadingCar). */}
            <Ionicons name="car-sport" size={13} color="#FFFFFF" style={{ transform: [{ scaleX: -1 }] }} />
          </Animated.View>
        )}
        <View style={styles.flowRow}>
          {APPROVAL_FLOW_STEPS.map((step, i) => {
            const stepNum = i + 1;
            const done = stepNum < currentStep;
            const active = stepNum === currentStep;
            return (
              <React.Fragment key={step.labelKey}>
                <View
                  style={styles.flowStep}
                  onLayout={(e) => handleStepLayout(i, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
                >
                  <View style={[styles.flowStepIconWrap, done && styles.flowStepIconWrapDone, active && styles.flowStepIconWrapActive]}>
                    {done ? (
                      <Ionicons name="checkmark" size={16} color={colors.success} />
                    ) : (
                      <Ionicons name={step.icon} size={16} color={active ? colors.accentText : colors.textMuted} />
                    )}
                  </View>
                  <Text style={[styles.flowStepLabel, active && styles.flowStepLabelActive]}>{t(step.labelKey)}</Text>
                </View>
                {i < APPROVAL_FLOW_STEPS.length - 1 && (
                  <View style={[styles.flowConnector, done && styles.flowConnectorDone]} />
                )}
              </React.Fragment>
            );
          })}
        </View>
      </View>
    </View>
  );
}

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

  const [vehicles, setVehicles] = useState<any[] | null>(null); // null = still loading; APPROVED only
  // Distinguishes "never added a vehicle" from "added one, still
  // waiting on review" — same underlying emptiness (nothing to select)
  // but a very different thing to tell the driver about it.
  const [hasUnapprovedVehicle, setHasUnapprovedVehicle] = useState(false);
  const [vehiclesError, setVehiclesError] = useState(false);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Pulled out so pull-to-refresh can call the exact same fetch as the
  // initial load — most relevant while sitting on the pending-review
  // empty state, where the whole point is checking whether an admin
  // has approved the vehicle yet without leaving the screen.
  function loadVehicles(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    api.getVehicles()
      .then((list) => {
        const approved = list.filter((v: any) => v.status === "APPROVED");
        setVehicles(approved);
        setHasUnapprovedVehicle(approved.length === 0 && list.length > 0);
        if (approved.length === 1) setVehicleId(approved[0].id);
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
      ) : vehicles !== null && vehicles.length === 0 && hasUnapprovedVehicle ? (
        <ScrollView
          contentContainerStyle={styles.centerState}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadVehicles(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        >
          <Text style={styles.noVehicleTitle}>{t("offerRide.vehiclePendingTitle")}</Text>
          <Text style={styles.noVehicleSubtitle}>{t("offerRide.vehiclePendingSubtitle")}</Text>
          <Pressable style={styles.button} onPress={() => navigation.navigate("VehicleList")}>
            <Text style={styles.buttonText}>{t("offerRide.viewYourVehicles")}</Text>
          </Pressable>
          <VehicleApprovalFlow currentStep={2} />
        </ScrollView>
      ) : vehicles !== null && vehicles.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.centerState}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadVehicles(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        >
          <Text style={styles.noVehicleTitle}>{t("offerRide.addVehicleToPublish")}</Text>
          <Text style={styles.noVehicleSubtitle}>{t("offerRide.addVehicleSubtitle")}</Text>
          <Pressable style={styles.button} onPress={() => navigation.navigate("AddVehicle")}>
            <Text style={styles.buttonText}>{t("vehicle.addVehicle")}</Text>
          </Pressable>
          <VehicleApprovalFlow currentStep={1} />
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
  flowCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    width: "100%",
  },
  flowTitle: { ...typography.caption, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.md, textAlign: "center" },
  flowRow: { flexDirection: "row", alignItems: "flex-start" },
  flowStep: { alignItems: "center", gap: 5, width: 64 },
  flowStepIconWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  flowStepIconWrapDone: { backgroundColor: colors.successBg, borderColor: colors.success },
  flowStepIconWrapActive: { backgroundColor: colors.accentBg, borderColor: colors.accent },
  flowStepLabel: { ...typography.small, color: colors.textMuted, textAlign: "center", fontSize: 10, lineHeight: 12 },
  flowStepLabelActive: { color: colors.accentText, fontWeight: "700" },
  flowConnector: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: -2, marginTop: 11 },
  flowConnectorDone: { backgroundColor: colors.success },
  // Same visual convention as StepTracker's own carBadge — marigold
  // circle, white shadow border, sitting exactly on top of whichever
  // step is currently active.
  flowCarBadge: {
    position: "absolute", left: 0, top: 0, width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.marigold, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.surface, zIndex: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3,
  },
});
