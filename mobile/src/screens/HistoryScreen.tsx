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
import { useTranslation } from "../lib/i18n/I18nContext";

// CONFIRMED deliberately excluded — once the platform fee's paid, the
// seat is locked in for real; self-cancelling never refunded it anyway
// (see backend bookings.routes.js /:id/cancel), so the option is gone
// rather than offering a button that only ever hurt the passenger.
const CANCELLABLE_STATUSES = ["BOOKED", "AWAITING_PAYMENT"];

// Passenger's full booking record — every status, not just active ones.
// This used to only show the same in-flight subset as "My requests"
// (its own bottom-nav tab), which meant the two tabs showed identical
// data and no one could tell what the difference between them was
// supposed to be. Now "My requests" is the action queue (what needs
// your attention right now) and this is the complete record (that,
// plus everything that's finished, been declined, or expired) —
// distinct, non-overlapping purposes for the two tabs.
const IN_FLIGHT_BOOKING_STATUSES = ["BOOKED", "AWAITING_PAYMENT", "CHARGE_ATTEMPTED", "PAYMENT_PENDING", "CONFIRMED", "IN_PROGRESS"];
// Driver's own "Your rides" (reached from Home, not a bottom-nav tab —
// no duplicate-tab problem here) stays scoped to what's still open or
// underway; full ride history isn't this screen's job for the driver side.
const ACTIVE_RIDE_STATUSES = ["PUBLISHED", "IN_PROGRESS"];

export default function HistoryScreen({ navigation, route }: any) {
  useScreenView("HistoryScreen");
  const { t } = useTranslation();
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
    if (role === "DRIVER") {
      api.getMyRides()
        .then((data: any[]) => setItems(data.filter((item) => ACTIVE_RIDE_STATUSES.includes(item.status))))
        .catch(() => setError(true))
        .finally(() => { setLoading(false); setRefreshing(false); });
      return;
    }
    // Passenger: every booking, not filtered by status — see the
    // IN_FLIGHT_BOOKING_STATUSES comment above for why.
    api.getMyBookings()
      .then((data: any[]) => setItems(data))
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
    showAlert(t("history.cancelBooking"), t("history.cancelBookingConfirm"), [
      { text: t("history.keepBooking"), style: "cancel" },
      {
        text: t("history.cancelBooking"),
        style: "destructive",
        onPress: async () => {
          try {
            await api.cancelBooking(bookingId);
            Analytics.bookingCancelled(bookingId, "PASSENGER");
            showSuccess(t("history.bookingCancelled"));
            load();
          } catch (err: any) {
            showError(err.message || t("history.couldntCancel"));
          }
        },
      },
    ]);
  }

  // Surfaced via a small info icon next to (or in place of) the "Cancel
  // ride" action, so a driver can see the actual rule — including why
  // cancelling might not even be offered right now — before deciding,
  // rather than only finding out from a rejected request. Mirrors the
  // real server-side rule in rides.routes.js DELETE /:id.
  function showCancelPolicy(hasConfirmedBooking: boolean) {
    showAlert(
      t("history.cancelPolicyTitle"),
      hasConfirmedBooking ? t("history.cancelPolicyBlocked") : t("history.cancelPolicyAvailable")
    );
  }

  function confirmCancelRide(rideId: string) {
    showAlert(
      t("history.cancelThisRide"),
      t("history.cancelRideConfirm"),
      [
        { text: t("history.keepRide"), style: "cancel" },
        {
          text: t("history.cancelRide"),
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteRide(rideId);
              Analytics.rideCancelled(rideId);
              showSuccess(t("history.rideCancelled"));
              load();
            } catch (err: any) {
              showError(err.message || t("history.couldntCancel"));
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>{role === "DRIVER" ? t("home.yourRides") : t("history.yourBookings")}</Text>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message={t("history.couldntLoadHistory")} onRetry={load} />
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
                <Text style={styles.route}>{t("common.routeTo", { source: item.sourceAddress, dest: item.destAddress })}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.meta}>{new Date(item.travelDate).toLocaleDateString()}</Text>
                <StatusBadge status={item.status} size="sm" />
              </View>
              {item.status === "PUBLISHED" && (
                <View style={styles.actionRow}>
                  <ActionChip
                    icon="mail-unread-outline"
                    label={t("home.bookingRequests")}
                    onPress={() => navigation.navigate("BookingRequests", { rideId: item.id })}
                  />
                  <ActionChip icon="create-outline" label={t("history.editRide")} onPress={() => navigation.navigate("EditRide", { ride: item })} />
                  {/* Once a passenger has actually paid, the ride can only
                      be edited, not cancelled outright — see DELETE /:id's
                      own guard, which enforces this regardless of what's
                      shown here. The info icon stays visible either way
                      (available or blocked) so the policy is one tap away
                      before a driver commits to cancelling. */}
                  {!item.hasConfirmedBooking && (
                    <ActionChip icon="close-circle-outline" label={t("history.cancelRide")} danger onPress={() => confirmCancelRide(item.id)} />
                  )}
                  <Pressable
                    style={styles.infoIconButton}
                    onPress={() => showCancelPolicy(!!item.hasConfirmedBooking)}
                    hitSlop={8}
                  >
                    <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                  </Pressable>
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
                <Text style={styles.route}>{t("common.routeTo", { source: item.ride?.sourceAddress, dest: item.ride?.destAddress })}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.fare}>{t("history.totalFare", { amount: Number(item.ride?.pricePerSeat) * item.seatsBooked })}</Text>
                {!IN_FLIGHT_BOOKING_STATUSES.includes(item.status) && <StatusBadge status={item.status} size="sm" />}
              </View>

              {/* The step tracker only makes sense for a booking still
                  moving through the journey — a finished, declined, or
                  expired one gets a plain status badge above instead
                  (bookingJourneySteps has no real mapping for those, so
                  showing it anyway used to render every terminal booking
                  as if it were stuck at "Requested"). */}
              {IN_FLIGHT_BOOKING_STATUSES.includes(item.status) && (
                <View style={styles.trackerWrap}>
                  <StepTracker steps={bookingJourneySteps(item.status, t)} />
                </View>
              )}

              {(item.status === "AWAITING_PAYMENT" || item.status === "PAYMENT_PENDING" || item.status === "CONFIRMED" || item.status === "IN_PROGRESS" || CANCELLABLE_STATUSES.includes(item.status)) && (
                <View style={styles.actionRow}>
                  {item.status === "AWAITING_PAYMENT" && (
                    <ActionChip
                      icon="wallet-outline"
                      label={t("history.payPlatformFee")}
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
                      label={t("history.retryPayment")}
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
                      <ActionChip icon="key-outline" label={t("history.tripCode")} onPress={() => navigation.navigate("TripOtp", { bookingId: item.id })} />
                      <ActionChip
                        icon="chatbubble-outline"
                        label={t("history.chat")}
                        badge={item.unreadMessageCount}
                        onPress={() => navigation.navigate("ChatDetail", { bookingId: item.id, calleeRole: "DRIVER" })}
                      />
                    </>
                  )}
                  {item.status === "IN_PROGRESS" && (
                    <ActionChip
                      icon="locate-outline"
                      label={t("history.trackTrip")}
                      primary
                      onPress={() => primeLocationIfNeeded(navigation, "LiveTracking", { bookingId: item.id, role: "PASSENGER" })}
                    />
                  )}
                  {CANCELLABLE_STATUSES.includes(item.status) && (
                    <ActionChip icon="close-circle-outline" label={t("history.cancelBooking")} danger onPress={() => confirmCancel(item.id)} />
                  )}
                </View>
              )}
            </Pressable>
          )
        }
        ListEmptyComponent={
          <EmptyState
            icon={role === "DRIVER" ? "car-outline" : "receipt-outline"}
            title={role === "DRIVER" ? t("history.noActiveRides") : t("history.noBookingsYet")}
            subtitle={role === "DRIVER" ? t("history.offerRideToSeeHere") : t("history.bookRideToSeeHere")}
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
  infoIconButton: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});
