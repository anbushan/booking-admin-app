import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { CarLoader } from "../components/CarLoader";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { primeLocationIfNeeded } from "../lib/locationPriming";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

// A passenger's own view of where each of their outstanding requests
// stands with the driver — a focused queue separate from "My bookings"
// (which lists everything, including trips long since finished). Only
// the not-yet-settled statuses show up here. CONFIRMED/IN_PROGRESS are
// included too — otherwise, the moment a mock/real payment succeeds and
// the booking flips to CONFIRMED, the row just vanishes from this list
// with no visible sign the payment went through.
const ACTIVE_STATUSES = ["BOOKED", "AWAITING_PAYMENT", "CHARGE_ATTEMPTED", "PAYMENT_PENDING", "CONFIRMED", "IN_PROGRESS"];

// Reuse status.* labelKeys where the wording matches exactly (payment
// in progress / failed); the rest carry extra context beyond a bare
// status name, so they live under myRequests.* instead.
const STATUS_LABEL_KEYS: Record<string, string> = {
  BOOKED: "myRequests.statusBooked",
  AWAITING_PAYMENT: "myRequests.statusAwaitingPayment",
  CHARGE_ATTEMPTED: "status.paymentInProgress",
  PAYMENT_PENDING: "status.paymentFailedRetry",
  CONFIRMED: "myRequests.statusConfirmed",
  IN_PROGRESS: "myRequests.statusInProgress",
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
  useScreenView("MyRequestsScreen");
  const { t } = useTranslation();
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
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>{t("myRequests.title")}</Text>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message={t("myRequests.couldntLoad")} onRetry={load} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={requests}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
          renderItem={({ item }) => {
            const mins = minutesLeft(item.expiresAt);
            return (
              // Whole card opens the full booking detail — the
              // status-specific action button below stays its own
              // Pressable and still fires independently on its own tap.
              <Pressable style={styles.card} onPress={() => navigation.navigate("BookingDetail", { bookingId: item.id })}>
                <Text style={styles.route}>{t("common.routeTo", { source: item.ride?.sourceAddress, dest: item.ride?.destAddress })}</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.meta}>
                    {item.ride?.driver?.name || t("register.driver")} · {t("common.seatsCount", { count: item.seatsBooked })}
                  </Text>
                  {mins != null && <Text style={styles.countdown}>{t("common.minutesLeft", { mins })}</Text>}
                </View>
                <Text style={styles.status}>{STATUS_LABEL_KEYS[item.status] ? t(STATUS_LABEL_KEYS[item.status]) : item.status}</Text>
                {(item.status === "AWAITING_PAYMENT" || item.status === "PAYMENT_PENDING") && (
                  <Pressable
                    style={styles.payButton}
                    onPress={() => navigation.navigate("Payment", {
                      bookingId: item.id,
                      amount: Number(item.platformFeeAmount),
                      description: t("payment.platformFeeLabel"),
                      retry: item.status === "PAYMENT_PENDING",
                    })}
                  >
                    <Text style={styles.payButtonText}>{item.status === "PAYMENT_PENDING" ? t("history.retryPayment") : t("myRequests.payNow")}</Text>
                  </Pressable>
                )}
                {item.status === "CONFIRMED" && (
                  <Pressable
                    style={styles.payButton}
                    onPress={() => navigation.navigate("TripOtp", { bookingId: item.id })}
                  >
                    <Text style={styles.payButtonText}>{t("myRequests.viewTripCode")}</Text>
                  </Pressable>
                )}
                {item.status === "IN_PROGRESS" && (
                  <Pressable
                    style={styles.payButton}
                    onPress={() => primeLocationIfNeeded(navigation, "LiveTracking", { bookingId: item.id, role: "PASSENGER" })}
                  >
                    <Text style={styles.payButtonText}>{t("history.trackTrip")}</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="hourglass-outline"
              title={t("myRequests.emptyTitle")}
              subtitle={t("myRequests.emptySubtitle")}
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
  payButtonText: { ...typography.caption, color: "#FFFFFF", fontWeight: "700" },
});
