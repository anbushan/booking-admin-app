import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { CarLoader } from "../components/CarLoader";
import { ErrorState } from "../components/ErrorState";
import { RouteTimeline } from "../components/RouteTimeline";
import { RouteStopsList } from "../components/RouteStopsList";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import Avatar from "../components/Avatar";
import { useTranslation } from "../lib/i18n/I18nContext";

type RideDetails = {
  id: string;
  sourceAddress: string;
  destAddress: string;
  sourceLat: number;
  sourceLng: number;
  pricePerSeat: string;
  // What THIS passenger actually owes per seat for their own matched
  // pickup->drop, not the ride's full-route price — see
  // rides.routes.js GET /:id/details. Falls back to the full ride price
  // server-side whenever no segment could be resolved, so this is always
  // present and always the right number to charge/display.
  segmentPricePerSeat: number;
  seatsAvailable: number;
  driver?: { name: string; ratingAvg?: number; photoViewUrl?: string | null };
  travelDate: string;
  estimatedArrivalAt: string;
  estimatedDurationMinutes: number;
  routeStops?: { lat: number; lng: number; placeName: string; distanceKm: number; durationMinutes: number }[] | null;
};

export default function BookingConfirmScreen({ route, navigation }: any) {
  useScreenView("BookingConfirmScreen");
  const { t } = useTranslation();
  const {
    rideId,
    // The passenger's own searched/matched pickup & drop (see
    // SearchResultsScreen) — absent when this screen was reached some
    // other way (e.g. a driver previewing their own ride), in which case
    // everything below falls back to the ride's own source/destination,
    // exactly the old behavior.
    pickupLat, pickupLng, pickupAddress,
    dropLat, dropLng, dropAddress,
  } = route.params;
  const [ride, setRide] = useState<RideDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [seats, setSeats] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    setError(false);
    api
      .getRideDetails(
        rideId,
        pickupLat != null ? { lat: pickupLat, lng: pickupLng } : undefined,
        dropLat != null ? { lat: dropLat, lng: dropLng } : undefined
      )
      .then((data) => {
        setRide(data);
        // Default to 1 seat, or 0 if the ride is already full — never
        // default to a count higher than what's actually left.
        setSeats(data.seatsAvailable > 0 ? 1 : 0);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useFocusEffect(useCallback(load, [rideId]));

  const full = !!ride && ride.seatsAvailable <= 0;
  const fare = ride ? Number(ride.segmentPricePerSeat ?? ride.pricePerSeat) * seats : 0;

  function adjustSeats(delta: number) {
    if (!ride) return;
    setSeats((s) => Math.max(1, Math.min(ride.seatsAvailable, 8, s + delta)));
  }

  async function handleRequestBooking() {
    if (!ride || full) return;
    setSubmitting(true);
    try {
      await api.createBooking({
        rideId,
        seatsBooked: seats,
        // Falls back to the ride's own source point only when this
        // screen genuinely has nothing better — passengers can still
        // override with a custom pickup from the map (see
        // MapPinConfirmScreen).
        pickupLat: pickupLat ?? ride.sourceLat,
        pickupLng: pickupLng ?? ride.sourceLng,
        pickupAddress: pickupAddress ?? ride.sourceAddress,
        // "Custom" here just means "not literally the ride's own
        // starting point" — it's what the driver's booking-request card
        // uses to decide whether to show a specific address or a plain
        // "Default pickup" label (BookingRequestsScreen.tsx). A search-
        // matched mid-route pickup (A1, not the ride's A) needs the real
        // address shown, same as a manually-dropped map pin would.
        isCustomPickup: pickupLat != null && (pickupLat !== ride.sourceLat || pickupLng !== ride.sourceLng),
        ...(dropLat != null ? { dropLat, dropLng, dropAddress, isCustomDrop: true } : {}),
      });
      Analytics.bookingCreated(rideId, seats);
      showAlert(t("booking.requestSent"), t("booking.driverHas20Min"));
      // Was navigating to Home, which meant the passenger had to find
      // their way back to "My requests" themselves to see the request
      // they just sent — land them right on it instead.
      navigation.navigate("MyRequests");
    } catch (err: any) {
      showAlert(t("booking.couldntBook"), err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("booking.confirmTitle")} onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error || !ride ? (
        <ErrorState message={t("booking.couldntLoadRide")} onRetry={load} />
      ) : (
        <View style={styles.body}>
          <View style={styles.routeRow}>
            <Ionicons name="navigate-outline" size={14} color={colors.textMuted} />
            <Text style={styles.route}>{t("common.routeTo", { source: ride.sourceAddress, dest: ride.destAddress })}</Text>
          </View>
          {ride.driver?.name && (
            <View style={styles.driverRow}>
              <Avatar uri={ride.driver.photoViewUrl} name={ride.driver.name} size={24} />
              <Text style={styles.driverName}>{ride.driver.name}</Text>
              {ride.driver.ratingAvg != null && (
                <View style={styles.driverRatingRow}>
                  <Ionicons name="star" size={10} color={colors.marigold} />
                  <Text style={styles.driverName}>{ride.driver.ratingAvg.toFixed(1)}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.timelineCard}>
            {ride.routeStops && ride.routeStops.length > 0 ? (
              // The full step-by-step route (like a train app's stop
              // list) — only available once a route's been computed for
              // this ride (see lib/directions.js on the backend).
              <RouteStopsList stops={ride.routeStops} departAt={ride.travelDate} />
            ) : (
              <RouteTimeline
                departAt={ride.travelDate}
                arriveAt={ride.estimatedArrivalAt}
                durationMinutes={ride.estimatedDurationMinutes}
                sourceAddress={ride.sourceAddress}
                destAddress={ride.destAddress}
              />
            )}
          </View>

          <View style={styles.row}>
            <View style={styles.labelRow}>
              <Ionicons name="people-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.label}>{t("searchOptions.seats")}</Text>
            </View>
            {full ? (
              <Text style={[styles.value, { color: colors.danger }]}>{t("search.full")}</Text>
            ) : (
              <View style={styles.stepper}>
                <Pressable
                  style={[styles.stepperButton, seats <= 1 && styles.stepperButtonDisabled]}
                  disabled={seats <= 1}
                  onPress={() => adjustSeats(-1)}
                >
                  <Ionicons name="remove" size={16} color={colors.textPrimary} />
                </Pressable>
                <Text style={styles.value}>{seats}</Text>
                <Pressable
                  style={[
                    styles.stepperButton,
                    seats >= Math.min(ride.seatsAvailable, 8) && styles.stepperButtonDisabled,
                  ]}
                  disabled={seats >= Math.min(ride.seatsAvailable, 8)}
                  onPress={() => adjustSeats(1)}
                >
                  <Ionicons name="add" size={16} color={colors.textPrimary} />
                </Pressable>
              </View>
            )}
          </View>
          <Text style={styles.availabilityHint}>
            {full ? t("booking.noSeatsLeft") : t("booking.seatsAvailable", { count: ride.seatsAvailable })}
          </Text>

          <View style={styles.row}>
            <View style={styles.labelRow}>
              <Ionicons name="cash-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.label}>{t("booking.fare")}</Text>
            </View>
            <Text style={styles.value}>Rs {fare}</Text>
          </View>

          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={16} color={colors.accentText} />
            <Text style={styles.noticeText}>{t("booking.feeNotice")}</Text>
          </View>

          <Pressable
            style={[styles.button, (submitting || full) && { opacity: 0.6 }]}
            onPress={handleRequestBooking}
            disabled={submitting || full}
          >
            {!full && !submitting && <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" />}
            <Text style={styles.buttonText}>
              {full ? t("booking.rideIsFull") : submitting ? t("booking.sendingRequest") : t("booking.requestBooking")}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg },
  routeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  route: { ...typography.title, fontSize: 15 },
  driverRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  driverName: { ...typography.caption, color: colors.textSecondary },
  driverRatingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginLeft: spacing.xs },
  timelineCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: spacing.md,
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { ...typography.caption, color: colors.textSecondary },
  value: { ...typography.title, fontVariant: ["tabular-nums"] },
  availabilityHint: { ...typography.small, color: colors.textMuted, marginTop: 4 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonDisabled: { opacity: 0.4 },
  notice: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.accentBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  noticeText: { ...typography.small, color: colors.accentText, flex: 1 },
  button: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  buttonText: { ...typography.title, color: "#FFFFFF" },
});
