import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { SkeletonBlock } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";
import { SafeAreaView } from "react-native-safe-area-context";

type RideDetails = {
  id: string;
  sourceAddress: string;
  destAddress: string;
  sourceLat: number;
  sourceLng: number;
  pricePerSeat: string;
  seatsAvailable: number;
  driver?: { name: string };
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

  useEffect(load, [rideId]);

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
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>Confirm booking</Text>
      </View>

      {loading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <SkeletonBlock style={{ height: 80, borderRadius: radius.md }} />
          <SkeletonBlock style={{ height: 46, borderRadius: radius.sm }} />
        </View>
      ) : error || !ride ? (
        <ErrorState message="Couldn't load this ride." onRetry={load} />
      ) : (
        <View style={styles.body}>
          <Text style={styles.route}>{ride.sourceAddress} to {ride.destAddress}</Text>
          {ride.driver?.name && <Text style={styles.driverName}>Driver: {ride.driver.name}</Text>}

          <View style={styles.row}>
            <Text style={styles.label}>Seats</Text>
            {full ? (
              <Text style={[styles.value, { color: colors.danger }]}>Full</Text>
            ) : (
              <View style={styles.stepper}>
                <Pressable
                  style={[styles.stepperButton, seats <= 1 && styles.stepperButtonDisabled]}
                  disabled={seats <= 1}
                  onPress={() => adjustSeats(-1)}
                >
                  <Text style={styles.stepperButtonText}>−</Text>
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
                  <Text style={styles.stepperButtonText}>+</Text>
                </Pressable>
              </View>
            )}
          </View>
          <Text style={styles.availabilityHint}>
            {full ? "No seats left on this ride." : `${ride.seatsAvailable} seat(s) available`}
          </Text>

          <View style={styles.row}>
            <Text style={styles.label}>Fare</Text>
            <Text style={styles.value}>Rs {fare}</Text>
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Pay after your trip completes. No charge until then.
            </Text>
          </View>

          <Pressable
            style={[styles.button, (submitting || full) && { opacity: 0.6 }]}
            onPress={handleRequestBooking}
            disabled={submitting || full}
          >
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
  route: { ...typography.title, fontSize: 15 },
  driverName: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: spacing.md,
  },
  label: { ...typography.caption, color: colors.textSecondary },
  value: typography.title,
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
  stepperButtonText: { fontSize: 16, color: colors.textPrimary },
  notice: {
    backgroundColor: colors.accentBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  noticeText: { ...typography.small, color: colors.accentText },
  button: {
    backgroundColor: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  buttonText: { color: "#FFFFFF", ...typography.title },
});
