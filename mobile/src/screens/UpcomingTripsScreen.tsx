import React, { useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { primeLocationIfNeeded } from "../lib/locationPriming";
import { SafeAreaView } from "react-native-safe-area-context";

// The driver-side counterpart to "Booking requests" — once a request is
// accepted it disappears from that pending list, but nothing anywhere
// showed a confirmed booking again until it was time to actually start
// the trip. This is that missing screen: every confirmed/in-progress
// booking across all of a driver's rides, with the actual "start trip"
// action, reusing the same driver-active data the chat list already
// fetches (this just adds the trip-starting action on top of it).

type Trip = {
  id: string;
  status: string;
  seatsBooked: number;
  passenger?: { name: string };
  ride?: { sourceAddress: string; destAddress: string };
};

export default function UpcomingTripsScreen({ navigation }: any) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    api
      .getDriverActiveBookings()
      .then((data: Trip[]) => setTrips(data.filter((t) => ["CONFIRMED", "IN_PROGRESS"].includes(t.status))))
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useFocusEffect(React.useCallback(() => { load(); }, []));

  function handleAction(trip: Trip) {
    if (trip.status === "CONFIRMED") {
      navigation.navigate("StartTrip", { bookingId: trip.id });
    } else {
      primeLocationIfNeeded(navigation, "ActiveTrip", { bookingId: trip.id, role: "DRIVER" });
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>Upcoming trips</Text>
      </View>

      {loading ? (
        <SkeletonList count={3} />
      ) : error ? (
        <ErrorState message="Couldn't load your trips." onRetry={load} />
      ) : (
        <FlatList
          data={trips}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.route}>{item.ride?.sourceAddress} to {item.ride?.destAddress}</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.meta}>{item.passenger?.name || "Passenger"} · {item.seatsBooked} seat(s)</Text>
                <Text style={item.status === "IN_PROGRESS" ? styles.statusActive : styles.statusConfirmed}>
                  {item.status === "IN_PROGRESS" ? "In progress" : "Confirmed"}
                </Text>
              </View>
              <Pressable style={styles.actionButton} onPress={() => handleAction(item)}>
                <Text style={styles.actionButtonText}>
                  {item.status === "IN_PROGRESS" ? "Continue trip" : "Start trip"}
                </Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No upcoming trips"
              subtitle="Accepted booking requests will show up here, ready to start."
            />
          }
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
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  route: { ...typography.title, fontSize: 14 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  meta: { ...typography.small, color: colors.textMuted },
  statusConfirmed: { ...typography.small, color: colors.accentText, backgroundColor: colors.accentBg, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  statusActive: { ...typography.small, color: colors.success, backgroundColor: colors.successBg, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  actionButton: { backgroundColor: colors.textPrimary, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  actionButtonText: { color: "#FFFFFF", ...typography.caption, fontWeight: "500" },
});
