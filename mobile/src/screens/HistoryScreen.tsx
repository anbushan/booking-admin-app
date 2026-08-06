import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { Analytics } from "../lib/analytics";
import { primeLocationIfNeeded } from "../lib/locationPriming";
import { SafeAreaView } from "react-native-safe-area-context";

const CANCELLABLE_STATUSES = ["BOOKED", "CONFIRMED"];

export default function HistoryScreen({ navigation, route }: any) {
  // role is optional — screens that already know it (e.g. a driver-only
  // flow) can pass it, but History is also reachable generically (side
  // menu, deep links) with no params at all, so fall back to the caller's
  // own profile rather than assuming a param that may not be there.
  const { role: paramRole } = route.params || {};
  const [role, setRole] = useState<string | undefined>(paramRole);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const { showSuccess, showError } = useToast();

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    const loadFn = role === "DRIVER" ? api.getMyRides : api.getMyBookings;
    loadFn()
      .then(setItems)
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => {
    if (paramRole) return;
    api.getMyProfile().then((p) => setRole(p.role)).catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (role) load();
  }, [role]);

  function confirmCancel(bookingId: string) {
    showAlert("Cancel booking", "Are you sure you want to cancel this booking?", [
      { text: "Keep booking", style: "cancel" },
      {
        text: "Cancel booking",
        style: "destructive",
        onPress: async () => {
          try {
            await api.cancelBooking(bookingId);
            Analytics.bookingCancelled(bookingId, "PASSENGER");
            showSuccess("Booking cancelled");
            load();
          } catch (err: any) {
            showError(err.message || "Couldn't cancel");
          }
        },
      },
    ]);
  }

  function confirmCancelRide(rideId: string) {
    showAlert(
      "Cancel this ride?",
      "Confirmed passengers will be notified and refunded if already charged.",
      [
        { text: "Keep ride", style: "cancel" },
        {
          text: "Cancel ride",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteRide(rideId);
              Analytics.rideCancelled(rideId);
              showSuccess("Ride cancelled");
              load();
            } catch (err: any) {
              showError(err.message || "Couldn't cancel");
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>{role === "DRIVER" ? "Your rides" : "Your bookings"}</Text>
      </View>
      {loading ? (
        <SkeletonList count={4} />
      ) : error ? (
        <ErrorState message="Couldn't load your history." onRetry={load} />
      ) : (
      <FlatList
        data={items}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) =>
          role === "DRIVER" ? (
            <View style={styles.card}>
              <Text style={styles.route}>{item.sourceAddress} to {item.destAddress}</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.meta}>{new Date(item.travelDate).toLocaleDateString()}</Text>
                <Text style={styles.status}>{item.status}</Text>
              </View>
              {item.status === "PUBLISHED" && (
                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.cancelLink}
                    onPress={() => navigation.navigate("BookingRequests", { rideId: item.id })}
                  >
                    <Text style={styles.cancelLinkText}>Booking requests</Text>
                  </Pressable>
                  <Pressable style={styles.cancelLink} onPress={() => navigation.navigate("EditRide", { ride: item })}>
                    <Text style={styles.cancelLinkText}>Edit ride</Text>
                  </Pressable>
                  <Pressable style={styles.cancelLink} onPress={() => confirmCancelRide(item.id)}>
                    <Text style={styles.dangerLinkText}>Cancel ride</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            <Pressable
              style={styles.card}
              onPress={() => {
                if (item.status === "PAID") {
                  navigation.navigate("RateReview", {
                    bookingId: item.id,
                    toUserId: item.ride.driverId,
                    toUserName: item.ride.driver?.name || "Driver",
                  });
                }
              }}
            >
              <Text style={styles.route}>{item.ride?.sourceAddress} to {item.ride?.destAddress}</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.meta}>Rs {Number(item.ride?.pricePerSeat) * item.seatsBooked}</Text>
                <Text style={styles.status}>{item.status}</Text>
              </View>
              {(item.status === "CONFIRMED" || item.status === "IN_PROGRESS" || CANCELLABLE_STATUSES.includes(item.status)) && (
                <View style={styles.actionRow}>
                  {item.status === "CONFIRMED" && (
                    <Pressable
                      style={styles.cancelLink}
                      onPress={() => navigation.navigate("TripOtp", { bookingId: item.id })}
                    >
                      <Text style={styles.cancelLinkText}>View trip code</Text>
                    </Pressable>
                  )}
                  {item.status === "IN_PROGRESS" && (
                    <Pressable
                      style={styles.cancelLink}
                      onPress={() => primeLocationIfNeeded(navigation, "LiveTracking", { bookingId: item.id, role: "PASSENGER" })}
                    >
                      <Text style={styles.cancelLinkText}>Track trip</Text>
                    </Pressable>
                  )}
                  {CANCELLABLE_STATUSES.includes(item.status) && (
                    <Pressable style={styles.cancelLink} onPress={() => confirmCancel(item.id)}>
                      <Text style={styles.dangerLinkText}>Cancel booking</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </Pressable>
          )
        }
        ListEmptyComponent={
          <EmptyState
            title={role === "DRIVER" ? "No rides yet" : "No bookings yet"}
            subtitle={role === "DRIVER" ? "Offer a ride to see it here." : "Book a ride to see it here."}
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
  route: { ...typography.title, fontSize: 13 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  meta: { ...typography.small, color: colors.textMuted },
  status: { ...typography.small, color: colors.accentText },
  cancelLink: { marginTop: spacing.sm },
  cancelLinkText: { ...typography.small, color: colors.accentText },
  dangerLinkText: { ...typography.small, color: colors.danger },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  empty: { textAlign: "center", marginTop: spacing.xl, color: colors.textMuted },
});
