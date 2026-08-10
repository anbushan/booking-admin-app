import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { CarLoader } from "../components/CarLoader";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { Analytics } from "../lib/analytics";
import { primeLocationIfNeeded } from "../lib/locationPriming";
import { UnreadBadge } from "../components/UnreadBadge";
import { StatusBadge } from "../components/StatusBadge";
import { StepTracker, bookingJourneySteps } from "../components/StepTracker";
import { AppBottomNav } from "../components/AppBottomNav";
import { SafeAreaView } from "react-native-safe-area-context";
import { appEvents } from "../lib/appEvents";
import { useScreenView } from "../lib/useScreenView";

// CONFIRMED deliberately excluded — once the platform fee's paid, the
// seat is locked in for real; self-cancelling never refunded it anyway
// (see backend bookings.routes.js /:id/cancel), so the option is gone
// rather than offering a button that only ever hurt the passenger.
const CANCELLABLE_STATUSES = ["BOOKED", "AWAITING_PAYMENT"];

// This screen shows the active trip(s) only, not a running history —
// full history lives in admin. COMPLETED is deliberately excluded here
// too: rating the driver now happens right when the trip ends (see
// LiveTrackingScreen), not by digging through this list afterward.
const ACTIVE_BOOKING_STATUSES = ["BOOKED", "AWAITING_PAYMENT", "CHARGE_ATTEMPTED", "PAYMENT_PENDING", "CONFIRMED", "IN_PROGRESS"];
const ACTIVE_RIDE_STATUSES = ["PUBLISHED", "IN_PROGRESS"];

export default function HistoryScreen({ navigation, route }: any) {
  useScreenView("HistoryScreen");
  // role is optional — screens that already know it (e.g. a driver-only
  // flow) can pass it, but History is also reachable generically (side
  // menu, deep links) with no params at all, so fall back to the caller's
  // own profile rather than assuming a param that may not be there.
  const { role: paramRole } = route.params || {};
  const [role, setRole] = useState<string | undefined>(paramRole);
  const [profile, setProfile] = useState<any>(null);
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
    const activeStatuses = role === "DRIVER" ? ACTIVE_RIDE_STATUSES : ACTIVE_BOOKING_STATUSES;
    loadFn()
      .then((data: any[]) => setItems(data.filter((item) => activeStatuses.includes(item.status))))
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => {
    // Always fetched (not just when `role` is missing) — AppBottomNav
    // needs the full profile object too (name for the side menu avatar).
    api.getMyProfile().then((p) => { setProfile(p); if (!paramRole) setRole(p.role); }).catch(() => { if (!paramRole) setError(true); });
  }, []);

  // useFocusEffect (not useEffect) — this screen stays mounted in the
  // stack when you navigate away from it (e.g. into a trip, a payment,
  // a chat), so a plain mount-only effect would keep showing whatever
  // status was true the last time it loaded. Refetching on every return
  // to this screen is what actually keeps "Cancel booking"/status text
  // in sync with what happened elsewhere.
  useFocusEffect(
    useCallback(() => {
      if (role) load();
    }, [role])
  );

  // Live "chat:new" (see AppSocketBridge) keeps each card's unread-chat
  // badge current without needing to leave and come back to this
  // screen — previously a message that arrived while this list was
  // already on screen just sat unreflected until the next refocus.
  useEffect(() => appEvents.on("chat:new", () => { if (role) load(); }), [role]);

  // Only reachable pre-payment now (CONFIRMED is no longer in
  // CANCELLABLE_STATUSES) — always a free withdrawal, nothing to warn
  // about forfeiting.
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
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>{role === "DRIVER" ? "Your rides" : "Your bookings"}</Text>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message="Couldn't load your history." onRetry={load} />
      ) : (
      <FlatList
        style={{ flex: 1 }}
        data={items}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, flexGrow: 1 }}
        renderItem={({ item }) =>
          role === "DRIVER" ? (
            <View style={styles.card}>
              <View style={styles.routeRow}>
                <Ionicons name="navigate-outline" size={13} color={colors.textMuted} />
                <Text style={styles.route}>{item.sourceAddress} to {item.destAddress}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.meta}>{new Date(item.travelDate).toLocaleDateString()}</Text>
                <StatusBadge status={item.status} size="sm" />
              </View>
              {item.status === "PUBLISHED" && (
                <View style={styles.actionRow}>
                  <ActionChip
                    icon="mail-unread-outline"
                    label="Booking requests"
                    onPress={() => navigation.navigate("BookingRequests", { rideId: item.id })}
                  />
                  <ActionChip icon="create-outline" label="Edit ride" onPress={() => navigation.navigate("EditRide", { ride: item })} />
                  {/* Once a passenger has actually paid, the ride can only
                      be edited, not cancelled outright — see DELETE /:id's
                      own guard, which enforces this regardless of what's
                      shown here. */}
                  {!item.hasConfirmedBooking && (
                    <ActionChip icon="close-circle-outline" label="Cancel ride" danger onPress={() => confirmCancelRide(item.id)} />
                  )}
                </View>
              )}
            </View>
          ) : (
            // Whole card opens the full booking detail — previously the
            // only way to reach BookingDetailScreen at all was tapping a
            // notification, with nothing in normal browsing linking to it.
            <Pressable style={styles.card} onPress={() => navigation.navigate("BookingDetail", { bookingId: item.id })}>
              <View style={styles.routeRow}>
                <Ionicons name="navigate-outline" size={13} color={colors.textMuted} />
                <Text style={styles.route}>{item.ride?.sourceAddress} to {item.ride?.destAddress}</Text>
              </View>
              <Text style={styles.fare}>Rs {Number(item.ride?.pricePerSeat) * item.seatsBooked} total</Text>

              <View style={styles.trackerWrap}>
                <StepTracker steps={bookingJourneySteps(item.status)} />
              </View>

              {(item.status === "AWAITING_PAYMENT" || item.status === "PAYMENT_PENDING" || item.status === "CONFIRMED" || item.status === "IN_PROGRESS" || CANCELLABLE_STATUSES.includes(item.status)) && (
                <View style={styles.actionRow}>
                  {item.status === "AWAITING_PAYMENT" && (
                    <ActionChip
                      icon="wallet-outline"
                      label="Pay platform fee"
                      primary
                      onPress={() => navigation.navigate("Payment", {
                        bookingId: item.id,
                        amount: Number(item.platformFeeAmount),
                        description: "Platform fee",
                      })}
                    />
                  )}
                  {/* PAYMENT_PENDING means the last charge attempt
                      failed (see PaymentQueueScreen's own label for
                      this status) — previously this status showed the
                      step tracker and then nothing, no way back to
                      Payment at all short of finding this booking from
                      MyRequestsScreen instead. */}
                  {item.status === "PAYMENT_PENDING" && (
                    <ActionChip
                      icon="refresh-outline"
                      label="Retry payment"
                      primary
                      onPress={() => navigation.navigate("Payment", {
                        bookingId: item.id,
                        amount: Number(item.platformFeeAmount),
                        description: "Platform fee",
                        retry: true,
                      })}
                    />
                  )}
                  {item.status === "CONFIRMED" && (
                    <>
                      <ActionChip icon="key-outline" label="Trip code" onPress={() => navigation.navigate("TripOtp", { bookingId: item.id })} />
                      <ActionChip
                        icon="chatbubble-outline"
                        label="Chat"
                        badge={item.unreadMessageCount}
                        onPress={() => navigation.navigate("ChatDetail", { bookingId: item.id, calleeRole: "DRIVER" })}
                      />
                    </>
                  )}
                  {item.status === "IN_PROGRESS" && (
                    <ActionChip
                      icon="locate-outline"
                      label="Track trip"
                      primary
                      onPress={() => primeLocationIfNeeded(navigation, "LiveTracking", { bookingId: item.id, role: "PASSENGER" })}
                    />
                  )}
                  {CANCELLABLE_STATUSES.includes(item.status) && (
                    <ActionChip icon="close-circle-outline" label="Cancel booking" danger onPress={() => confirmCancel(item.id)} />
                  )}
                </View>
              )}
            </Pressable>
          )
        }
        ListEmptyComponent={
          <EmptyState
            icon={role === "DRIVER" ? "car-outline" : "receipt-outline"}
            title={role === "DRIVER" ? "No active rides" : "No active bookings"}
            subtitle={role === "DRIVER" ? "Offer a ride to see it here." : "Book a ride to see it here."}
          />
        }
      />
      )}
      <AppBottomNav navigation={navigation} profile={profile} active={role === "DRIVER" ? "menu" : "bookings"} />
    </SafeAreaView>
  );
}

function ActionChip({
  icon, label, onPress, primary, danger, badge,
}: {
  icon: string; label: string; onPress: () => void; primary?: boolean; danger?: boolean; badge?: number;
}) {
  return (
    <Pressable
      style={[styles.chip, primary && styles.chipPrimary, danger && styles.chipDanger]}
      onPress={onPress}
    >
      <Ionicons
        name={icon as any}
        size={14}
        color={primary ? "#FFFFFF" : danger ? colors.danger : colors.accentText}
      />
      <Text style={[styles.chipText, primary && styles.chipTextPrimary, danger && styles.chipTextDanger]}>
        {label}
      </Text>
      <UnreadBadge count={badge || 0} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  routeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  route: { ...typography.title, fontSize: 13 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  meta: { ...typography.small, color: colors.textMuted },
  fare: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  trackerWrap: { marginBottom: spacing.xs },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: colors.accentBg, borderRadius: radius.sm,
    paddingVertical: 7, paddingHorizontal: 10,
  },
  chipPrimary: { backgroundColor: colors.marigold },
  chipDanger: { backgroundColor: colors.dangerBg },
  chipText: { ...typography.small, color: colors.accentText, fontWeight: "700" },
  chipTextPrimary: { color: "#FFFFFF" },
  chipTextDanger: { color: colors.danger },
});
