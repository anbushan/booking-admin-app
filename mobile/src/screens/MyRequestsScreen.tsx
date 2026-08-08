import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { primeLocationIfNeeded } from "../lib/locationPriming";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "../components/AppHeader";
import { AppBottomNav } from "../components/AppBottomNav";

// A passenger's own view of where each of their outstanding requests
// stands with the driver — a focused queue separate from "My bookings"
// (which lists everything, including trips long since finished). Only
// the not-yet-settled statuses show up here. CONFIRMED/IN_PROGRESS are
// included too — otherwise, the moment a mock/real payment succeeds and
// the booking flips to CONFIRMED, the row just vanishes from this list
// with no visible sign the payment went through.
const ACTIVE_STATUSES = ["BOOKED", "AWAITING_PAYMENT", "CHARGE_ATTEMPTED", "PAYMENT_PENDING", "CONFIRMED", "IN_PROGRESS"];

const STATUS_LABELS: Record<string, string> = {
  BOOKED: "Waiting for driver to respond",
  AWAITING_PAYMENT: "Accepted — pay to confirm",
  CHARGE_ATTEMPTED: "Payment in progress",
  PAYMENT_PENDING: "Payment failed — retry",
  CONFIRMED: "Confirmed — trip code ready",
  IN_PROGRESS: "Trip in progress",
};

type RequestItem = {
  id: string;
  status: string;
  seatsBooked: number;
  expiresAt: string | null;
  platformFeeAmount: string | number | null;
  ride?: { sourceAddress: string; destAddress: string; driver?: { name: string } };
};

function minutesLeft(expiresAt: string | null) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.round(diff / 60000));
}

export default function MyRequestsScreen({ navigation }: any) {
  const [requests, setRequests] = useState<RequestItem[]>([]);
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
      .getMyBookings()
      .then((data: RequestItem[]) => setRequests(data.filter((b) => ACTIVE_STATUSES.includes(b.status))))
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useFocusEffect(useCallback(load, []));

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <AppHeader title="My requests" />

      {loading ? (
        <SkeletonList count={3} />
      ) : error ? (
        <ErrorState message="Couldn't load your requests." onRetry={load} />
      ) : (
        <FlatList
          data={requests}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          renderItem={({ item }) => {
            const mins = minutesLeft(item.expiresAt);
            return (
              <View style={styles.card}>
                <Text style={styles.route}>{item.ride?.sourceAddress} to {item.ride?.destAddress}</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.meta}>
                    {item.ride?.driver?.name || "Driver"} · {item.seatsBooked} seat(s)
                  </Text>
                  {mins != null && <Text style={styles.countdown}>{mins}m left</Text>}
                </View>
                <Text style={styles.status}>{STATUS_LABELS[item.status] || item.status}</Text>
                {(item.status === "AWAITING_PAYMENT" || item.status === "PAYMENT_PENDING") && (
                  <Pressable
                    style={styles.payButton}
                    onPress={() => navigation.navigate("Payment", {
                      bookingId: item.id,
                      amount: Number(item.platformFeeAmount),
                      description: "Platform fee",
                    })}
                  >
                    <Text style={styles.payButtonText}>Pay now</Text>
                  </Pressable>
                )}
                {item.status === "CONFIRMED" && (
                  <Pressable
                    style={styles.payButton}
                    onPress={() => navigation.navigate("TripOtp", { bookingId: item.id })}
                  >
                    <Text style={styles.payButtonText}>View trip code</Text>
                  </Pressable>
                )}
                {item.status === "IN_PROGRESS" && (
                  <Pressable
                    style={styles.payButton}
                    onPress={() => primeLocationIfNeeded(navigation, "LiveTracking", { bookingId: item.id, role: "PASSENGER" })}
                  >
                    <Text style={styles.payButtonText}>Track trip</Text>
                  </Pressable>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="hourglass-outline"
              title="No pending requests"
              subtitle="Requests you send to drivers will show up here until they're confirmed."
            />
          }
        />
      )}
      <AppBottomNav navigation={navigation} profile={profile} active="myRequests" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  route: { ...typography.title, fontSize: 14 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meta: { ...typography.small, color: colors.textMuted },
  countdown: { ...typography.small, color: colors.textMuted },
  status: { ...typography.small, color: colors.warning, backgroundColor: colors.warningBg, alignSelf: "flex-start", paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  payButton: { backgroundColor: colors.textPrimary, height: 38, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.xs },
  payButtonText: { color: "#FFFFFF", ...typography.caption, fontWeight: "500" },
});
