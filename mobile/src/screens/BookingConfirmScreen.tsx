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

type RideDetails = {
  id: string;
  sourceAddress: string;
  destAddress: string;
  sourceLat: number;
  sourceLng: number;
  pricePerSeat: string;
  seatsAvailable: number;
  driver?: { name: string };
  travelDate: string;
  estimatedArrivalAt: string;
  estimatedDurationMinutes: number;
  routeStops?: { lat: number; lng: number; placeName: string; distanceKm: number; durationMinutes: number }[] | null;
};

export default function BookingConfirmScreen({ route, navigation }: any) {
  const { rideId } = route.params;
  const [ride, setRide] = useState<RideDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [seats, setSeats] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    setError(false);
    api
      .getRideDetails(rideId)
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
  const fare = ride ? Number(ride.pricePerSeat) * seats : 0;

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
        // Defaults to the ride's own pickup point — passengers can still
        // pick a custom pickup from the map (see MapPinConfirmScreen);
        // this is just what gets sent if they book without changing it.
        pickupLat: ride.sourceLat,
        pickupLng: ride.sourceLng,
        pickupAddress: ride.sourceAddress,
      });
      Analytics.bookingCreated(rideId, seats);
      showAlert("Request sent", "The driver has 20 minutes to respond.");
      navigation.navigate("Home");
    } catch (err: any) {
      showAlert("Couldn't book", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title="Confirm booking" onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error || !ride ? (
        <ErrorState message="Couldn't load this ride." onRetry={load} />
      ) : (
        <View style={styles.body}>
          <View style={styles.routeRow}>
            <Ionicons name="navigate-outline" size={14} color={colors.textMuted} />
            <Text style={styles.route}>{ride.sourceAddress} to {ride.destAddress}</Text>
          </View>
          {ride.driver?.name && (
            <View style={styles.driverRow}>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverAvatarText}>{ride.driver.name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.driverName}>{ride.driver.name}</Text>
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
              <Text style={styles.label}>Seats</Text>
            </View>
            {full ? (
              <Text style={[styles.value, { color: colors.danger }]}>Full</Text>
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
            {full ? "No seats left on this ride." : `${ride.seatsAvailable} seat(s) available`}
          </Text>

          <View style={styles.row}>
            <View style={styles.labelRow}>
              <Ionicons name="cash-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.label}>Fare</Text>
            </View>
            <Text style={styles.value}>Rs {fare}</Text>
          </View>

          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={16} color={colors.accentText} />
            <Text style={styles.noticeText}>
              If the driver accepts, you'll need to pay a platform fee to confirm your seat.
              The rest of the fare is paid directly to the driver after the trip.
            </Text>
          </View>

          <Pressable
            style={[styles.button, (submitting || full) && { opacity: 0.6 }]}
            onPress={handleRequestBooking}
            disabled={submitting || full}
          >
            {!full && !submitting && <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" />}
            <Text style={styles.buttonText}>
              {full ? "Ride is full" : submitting ? "Sending request..." : "Request booking"}
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
  driverAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  driverAvatarText: { fontSize: 11, fontWeight: "700", color: colors.accentText },
  driverName: { ...typography.caption, color: colors.textSecondary },
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
    backgroundColor: colors.marigold,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  buttonText: { color: "#FFFFFF", ...typography.title },
});
