import React, { useEffect, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { ErrorState } from "../components/ErrorState";
import { RouteStopsList } from "../components/RouteStopsList";
import { CarLoader } from "../components/CarLoader";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackButton } from "../components/BackButton";

type Stop = { lat: number; lng: number; placeName: string; distanceKm: number; durationMinutes: number };
type RouteOption = { summary: string; polyline: string; distanceKm: number; durationMinutes: number; stops: Stop[] };

// Always shown after OfferRideScreen, even for a plain point-to-point
// trip with no meaningfully different alternative shape — Directions
// returning just one route in that case is expected, not an error; this
// screen just shows a single card. Publishing itself (api.createRide)
// happens here, once a route is picked, not on the previous screen.
export default function RouteOptionsScreen({ route, navigation }: any) {
  const rideForm = route.params;
  const [alternatives, setAlternatives] = useState<RouteOption[] | null>(null);
  const [error, setError] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    api
      .getRouteOptions(rideForm.sourceLat, rideForm.sourceLng, rideForm.sourceAddress, rideForm.destLat, rideForm.destLng, rideForm.destAddress)
      .then((data) => setAlternatives(data.alternatives || []))
      .catch(() => setError(true));
  }, []);

  async function selectRoute(alt: RouteOption | null) {
    setPublishing(true);
    try {
      const ride = await api.createRide({
        sourceLat: rideForm.sourceLat, sourceLng: rideForm.sourceLng, sourceAddress: rideForm.sourceAddress,
        destLat: rideForm.destLat, destLng: rideForm.destLng, destAddress: rideForm.destAddress,
        travelDate: rideForm.travelDate,
        seatsAvailable: rideForm.seatsAvailable,
        pricePerSeat: rideForm.pricePerSeat,
        preferences: rideForm.preferences,
        ...(rideForm.vehicleId ? { vehicleId: rideForm.vehicleId } : {}),
        ...(alt ? {
          routePolyline: alt.polyline,
          routeStops: alt.stops,
          routeDistanceKm: alt.distanceKm,
          routeDurationMinutes: alt.durationMinutes,
        } : {}),
      });
      Analytics.ridePublished(ride?.id || "");
      showAlert("Ride published", "Passengers can now find and book your ride.");
      navigation.navigate("History", { role: "DRIVER" });
    } catch (err: any) {
      showAlert("Couldn't publish ride", err.message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.title}>Search routes</Text>
      </View>

      {alternatives === null && !error ? (
        <View style={styles.centerState}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message="Couldn't load route options." onRetry={() => { setError(false); setAlternatives(null); }} />
      ) : alternatives.length === 0 ? (
        // Directions couldn't resolve a route at all — not a hard
        // blocker, publish still works, just without route-aware
        // matching/stop list for this ride (same as a ride published
        // before this feature existed).
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>Couldn't compute a route</Text>
          <Text style={styles.emptySubtitle}>You can still publish — passengers will just be matched on your source and destination only.</Text>
          <Pressable style={styles.button} onPress={() => selectRoute(null)} disabled={publishing}>
            <Text style={styles.buttonText}>{publishing ? "Publishing..." : "Publish anyway"}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={alternatives}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.summary}>{item.summary}</Text>
              <Text style={styles.meta}>{item.distanceKm} km · {item.durationMinutes} min</Text>
              <RouteStopsList stops={item.stops} departAt={rideForm.travelDate} />
              <Pressable style={styles.button} onPress={() => selectRoute(item)} disabled={publishing}>
                <Text style={styles.buttonText}>{publishing ? "Publishing..." : "Publish this route"}</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  back: { fontSize: 18 },
  title: typography.title,
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md },
  emptyTitle: { ...typography.title, textAlign: "center" },
  emptySubtitle: { ...typography.small, color: colors.textMuted, textAlign: "center" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  summary: { ...typography.title, fontSize: 14 },
  meta: { ...typography.small, color: colors.textMuted },
  button: { backgroundColor: colors.textPrimary, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.xs },
  buttonText: { color: "#FFFFFF", ...typography.body, fontWeight: "500" },
});
