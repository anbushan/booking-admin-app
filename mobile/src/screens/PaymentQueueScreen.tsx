import React, { useState, useCallback, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { CarLoader } from "../components/CarLoader";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";
import { CompactStepTracker } from "../components/CompactStepTracker";
import { bookingJourneySteps } from "../components/StepTracker";

// Bookings a driver has already accepted where the passenger still owes
// the platform fee — a focused queue separate from "Upcoming trips"
// (which only shows CONFIRMED-or-later, i.e. already paid). Purely
// informational: a driver can't force a passenger to pay any faster than
// the pay window/retry cycle already allows, so there's no action here,
// just visibility into who's still pending.
const QUEUE_STATUSES = ["AWAITING_PAYMENT", "CHARGE_ATTEMPTED", "PAYMENT_PENDING"];

const STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  CHARGE_ATTEMPTED: "Payment in progress",
  PAYMENT_PENDING: "Payment failed — retrying",
};

type QueuedBooking = {
  id: string;
  status: string;
  seatsBooked: number;
  expiresAt: string | null;
  platformFeeAmount: string | number | null;
  passenger?: { name: string };
  ride?: { sourceAddress: string; destAddress: string };
};

function minutesLeft(expiresAt: string | null) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.round(diff / 60000));
}

export default function PaymentQueueScreen({ navigation }: any) {
  const [bookings, setBookings] = useState<QueuedBooking[]>([]);
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
      .then((data: QueuedBooking[]) => setBookings(data.filter((b) => QUEUE_STATUSES.includes(b.status))))
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useFocusEffect(useCallback(load, []));

  // Unlike most other lists here, what moves a booking off this screen
  // (the passenger actually paying) is entirely outside the driver's own
  // actions — pull-to-refresh/refocus alone would leave a paid booking
  // sitting here looking unpaid until the driver happens to leave and
  // come back. Polling while this screen is open keeps it current
  // without the driver having to do anything.
  useEffect(() => {
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>Payment queue</Text>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message="Couldn't load the payment queue." onRetry={load} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={bookings}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
          ListHeaderComponent={
            bookings.length > 0 ? (
              <View style={styles.notice}>
                <Ionicons name="information-circle-outline" size={16} color={colors.accentText} />
                <Text style={styles.noticeText}>
                  Nothing to do here yet — this just tracks who still owes the platform fee. It moves
                  to "Start trip now" automatically once they pay.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const mins = minutesLeft(item.expiresAt);
            return (
              // Nothing actionable here (see the comment above), but
              // tapping through to the full booking detail was still
              // missing — the only entry point into BookingDetailScreen
              // used to be a notification tap.
              <Pressable style={styles.card} onPress={() => navigation.navigate("BookingDetail", { bookingId: item.id })}>
                <Text style={styles.route}>{item.ride?.sourceAddress} to {item.ride?.destAddress}</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.meta}>
                    {item.passenger?.name || "Passenger"} · {item.seatsBooked} seat(s)
                  </Text>
                  <Text style={styles.fee}>
                    {item.platformFeeAmount != null ? `Rs ${Number(item.platformFeeAmount)}` : "—"}
                  </Text>
                </View>

                <View style={styles.trackerBlock}>
                  <CompactStepTracker steps={bookingJourneySteps(item.status)} />
                </View>

                <View style={styles.rowBetween}>
                  <View style={styles.statusRow}>
                    <Ionicons name="time-outline" size={12} color={colors.warning} />
                    <Text style={styles.status}>{STATUS_LABELS[item.status] || item.status}</Text>
                  </View>
                  {mins != null && (
                    <Text style={styles.countdown}>{mins}m left to pay</Text>
                  )}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="wallet-outline"
              title="Nothing pending"
              subtitle="Accepted requests waiting on a passenger's platform-fee payment will show up here."
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
  notice: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: colors.accentBg, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.xs },
  noticeText: { ...typography.small, color: colors.accentText, flex: 1, lineHeight: 17 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  route: { ...typography.title, fontSize: 14 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meta: { ...typography.small, color: colors.textMuted },
  fee: { ...typography.caption, fontWeight: "700", color: colors.textPrimary },
  trackerBlock: { paddingVertical: spacing.xs },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  status: { ...typography.small, color: colors.warning, backgroundColor: colors.warningBg, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  countdown: { ...typography.small, color: colors.textMuted },
});
