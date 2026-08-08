import React, { useState, useEffect } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { CarLoader } from "../components/CarLoader";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { primeLocationIfNeeded } from "../lib/locationPriming";
import { UnreadBadge } from "../components/UnreadBadge";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";

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
  unreadMessageCount?: number;
};

export default function UpcomingTripsScreen({ navigation }: any) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.getMyProfile().then(setProfile).catch(() => {});
  }, []);

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    api
      .getDriverActiveBookings()
      .then((data: Trip[]) => setTrips(data.filter((t) => ["AWAITING_PAYMENT", "CONFIRMED", "IN_PROGRESS"].includes(t.status))))
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
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>Upcoming trips</Text>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message="Couldn't load your trips." onRetry={load} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={trips}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.route}>{item.ride?.sourceAddress} to {item.ride?.destAddress}</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.meta}>{item.passenger?.name || "Passenger"} · {item.seatsBooked} seat(s)</Text>
                <Text style={item.status === "IN_PROGRESS" ? styles.statusActive : item.status === "AWAITING_PAYMENT" ? styles.statusPending : styles.statusConfirmed}>
                  {item.status === "IN_PROGRESS" ? "In progress" : item.status === "AWAITING_PAYMENT" ? "Awaiting payment" : "Confirmed"}
                </Text>
              </View>
              {item.status === "AWAITING_PAYMENT" ? (
                // Not actionable yet — the passenger hasn't paid the
                // platform fee, so there's nothing to start. Accepting a
                // request doesn't mean confirmed; this state makes that
                // visible instead of the booking just disappearing until
                // payment (or the pay window expiring) happens silently.
                <Text style={styles.pendingCaption}>Waiting for the passenger to pay the platform fee.</Text>
              ) : (
                <View style={styles.actionRow}>
                  <Pressable style={[styles.actionButton, { flex: 1 }]} onPress={() => handleAction(item)}>
                    <Text style={styles.actionButtonText}>
                      {item.status === "IN_PROGRESS" ? "Continue trip" : "Start trip"}
                    </Text>
                  </Pressable>
                  {item.status === "CONFIRMED" && (
                    <Pressable
                      style={[styles.actionButton, styles.chatButton, { flexDirection: "row", alignItems: "center" }]}
                      onPress={() => navigation.navigate("ChatDetail", { bookingId: item.id, calleeRole: "PASSENGER" })}
                    >
                      <Text style={styles.chatButtonText}>Chat</Text>
                      <UnreadBadge count={item.unreadMessageCount} />
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="navigate-outline"
              title="No upcoming trips"
              subtitle="Accepted booking requests will show up here, ready to start."
            />
          }
        />
      )}
      <AppBottomNav navigation={navigation} profile={profile} active="menu" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  route: { ...typography.title, fontSize: 14 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  meta: { ...typography.small, color: colors.textMuted },
  statusConfirmed: { ...typography.small, color: colors.accentText, backgroundColor: colors.accentBg, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  statusActive: { ...typography.small, color: colors.success, backgroundColor: colors.successBg, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  statusPending: { ...typography.small, color: colors.warning, backgroundColor: colors.warningBg, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  pendingCaption: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  actionButton: { backgroundColor: colors.textPrimary, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  actionButtonText: { color: "#FFFFFF", ...typography.caption, fontWeight: "500" },
  chatButton: { flex: 0, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chatButtonText: { color: colors.accentText, ...typography.caption, fontWeight: "500" },
});
