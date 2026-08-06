import React, { useEffect, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, Alert, RefreshControl } from "react-native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";

type BookingRequest = {
  id: string;
  passenger: { name: string; ratingAvg: number };
  seatsBooked: number;
  isCustomPickup: boolean;
  pickupAddress: string;
  expiresAt: string;
  ride?: { id: string; sourceAddress: string; destAddress: string };
};

function minutesLeft(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.round(diff / 60000));
}

export default function BookingRequestsScreen({ route, navigation }: any) {
  // With a rideId (opened from a specific ride's card): requests for that
  // ride only. Without one (opened from the side menu / driver Home): the
  // aggregate inbox across every ride this driver has published, so
  // there's one place to approve/reject everything rather than having to
  // open each ride individually.
  const { rideId } = route.params || {};
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [, forceTick] = useState(0);
  const { showSuccess, showError } = useToast();

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    const loadFn = rideId ? () => api.getRideBookings(rideId) : api.getDriverPendingRequests;
    loadFn().then(setRequests).catch(() => setError(true)).finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => {
    load();
    // re-render every 30s so the countdown labels stay roughly current
    const interval = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, [rideId]);

  async function respond(bookingId: string, action: "accept" | "reject") {
    try {
      if (action === "accept") { await api.acceptBooking(bookingId); Analytics.bookingAccepted(bookingId); }
      else { await api.rejectBooking(bookingId); Analytics.bookingRejected(bookingId); }
      setRequests((prev) => prev.filter((r) => r.id !== bookingId));
      showSuccess(action === "accept" ? "Booking accepted" : "Booking declined");
    } catch (err: any) {
      showError(err.message || "Couldn't update booking");
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>{rideId ? "Booking requests" : "All booking requests"}</Text>
      </View>

      {loading ? (
        <SkeletonList count={3} />
      ) : error ? (
        <ErrorState message="Couldn't load requests." onRetry={load} />
      ) : (
      <FlatList
        data={requests}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable onPress={() => navigation.navigate("BookingRequestDetail", { request: item })}>
              {item.ride && (
                <Text style={styles.rideRoute}>{item.ride.sourceAddress} to {item.ride.destAddress}</Text>
              )}
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.passengerName}>{item.passenger?.name || "Passenger"}</Text>
                  <Text style={styles.meta}>
                    {(item.passenger?.ratingAvg ?? 0).toFixed(1)} rating · {item.seatsBooked} seat(s)
                  </Text>
                </View>
                <Text style={styles.countdown}>{minutesLeft(item.expiresAt)}m left</Text>
              </View>
              <Text style={styles.pickup}>
                {item.isCustomPickup ? `Custom pickup: ${item.pickupAddress}` : "Default pickup point"}
              </Text>
            </Pressable>
            <View style={styles.actionRow}>
              <Pressable style={styles.acceptButton} onPress={() => respond(item.id, "accept")}>
                <Text style={styles.acceptText}>Accept</Text>
              </Pressable>
              <Pressable style={styles.declineButton} onPress={() => respond(item.id, "reject")}>
                <Text style={styles.declineText}>Decline</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState title="No pending requests" subtitle="New booking requests will show up here." />
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
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rideRoute: { ...typography.small, color: colors.textMuted, marginBottom: spacing.xs },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  passengerName: { ...typography.title, fontSize: 14 },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  countdown: { ...typography.small, color: colors.warning, backgroundColor: colors.warningBg, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  pickup: { ...typography.small, color: colors.textSecondary, marginTop: spacing.sm },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  acceptButton: { flex: 1, backgroundColor: colors.textPrimary, height: 36, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  acceptText: { color: "#FFFFFF", ...typography.caption, fontWeight: "500" },
  declineButton: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, height: 36, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  declineText: { ...typography.caption, color: colors.textSecondary },
  empty: { textAlign: "center", marginTop: spacing.xl, color: colors.textMuted },
});
