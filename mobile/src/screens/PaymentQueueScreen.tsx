import React, { useState, useCallback, useEffect } from "react";
import { View, Text, SectionList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonSectionHeader, SkeletonCard } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { CompactStepTracker } from "../components/CompactStepTracker";
import { bookingJourneySteps } from "../components/StepTracker";
import { groupByRide } from "../lib/groupByRide";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

// Bookings a driver has already accepted where the passenger still owes
// the platform fee — a focused queue separate from "Upcoming trips"
// (which only shows CONFIRMED-or-later, i.e. already paid). Purely
// informational: a driver can't force a passenger to pay any faster than
// the pay window/retry cycle already allows, so there's no action here,
// just visibility into who's still pending.
const QUEUE_STATUSES = ["AWAITING_PAYMENT", "CHARGE_ATTEMPTED", "PAYMENT_PENDING"];

// Reuse the same status labelKeys StatusBadge/getStatusMeta use elsewhere
// (theme.ts) rather than duplicating translated copy for these statuses.
const STATUS_LABEL_KEYS: Record<string, string> = {
  AWAITING_PAYMENT: "status.payToConfirm",
  CHARGE_ATTEMPTED: "status.paymentInProgress",
  PAYMENT_PENDING: "status.paymentFailedRetry",
};

type QueuedBooking = {
  id: string;
  status: string;
  seatsBooked: number;
  expiresAt: string | null;
  platformFeeAmount: string | number | null;
  passenger?: { name: string };
  ride?: { sourceAddress: string; destAddress: string; travelDate?: string };
};

function minutesLeft(expiresAt: string | null) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.round(diff / 60000));
}

export default function PaymentQueueScreen({ navigation }: any) {
  useScreenView("PaymentQueueScreen");
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<QueuedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

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

  const sections = groupByRide(bookings);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("payment.queueTitle")} onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={{ flex: 1, paddingBottom: spacing.md }}>
          <SkeletonSectionHeader />
          <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        </View>
      ) : error ? (
        <ErrorState message={t("payment.couldntLoadQueue")} onRetry={load} />
      ) : (
        <SectionList
          style={{ flex: 1 }}
          sections={sections}
          maxToRenderPerBatch={8}
          windowSize={7}
          initialNumToRender={8}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            bookings.length > 0 ? (
              <View style={styles.notice}>
                <Ionicons name="information-circle-outline" size={16} color={colors.accentText} />
                <Text style={styles.noticeText}>
                  {t("payment.queueNotice", { label: t("home.startTripNow") })}
                </Text>
              </View>
            ) : null
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Ionicons name="navigate-outline" size={13} color={colors.accentText} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
              </View>
            </View>
          )}
          renderItem={({ item }) => {
            const mins = minutesLeft(item.expiresAt);
            return (
              // Nothing actionable here (see the comment above), but
              // tapping through to the full booking detail was still
              // missing — the only entry point into BookingDetailScreen
              // used to be a notification tap.
              <Pressable style={styles.card} onPress={() => navigation.navigate("BookingDetail", { bookingId: item.id })}>
                <View style={styles.rowBetween}>
                  <Text style={styles.meta}>
                    {item.passenger?.name || t("register.passenger")} · {t("common.seatsCount", { count: item.seatsBooked })}
                  </Text>
                  <Text style={styles.fee}>
                    {item.platformFeeAmount != null ? `Rs ${Number(item.platformFeeAmount)}` : "—"}
                  </Text>
                </View>

                <View style={styles.trackerBlock}>
                  <CompactStepTracker steps={bookingJourneySteps(item.status, t)} />
                </View>

                <View style={styles.rowBetween}>
                  <View style={styles.statusRow}>
                    <Ionicons name="time-outline" size={12} color={colors.warning} />
                    <Text style={styles.status}>{STATUS_LABEL_KEYS[item.status] ? t(STATUS_LABEL_KEYS[item.status]) : item.status}</Text>
                  </View>
                  {mins != null && (
                    <Text style={styles.countdown}>{t("payment.minutesLeftToPay", { mins })}</Text>
                  )}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="wallet-outline"
              title={t("payment.queueEmptyTitle")}
              subtitle={t("payment.queueEmptySubtitle")}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  notice: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: colors.accentBg, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.xs },
  noticeText: { ...typography.small, color: colors.accentText, flex: 1, lineHeight: 17 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: 2 },
  sectionTitle: { ...typography.title, fontSize: 13, color: colors.accentText },
  sectionSubtitle: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meta: { ...typography.small, color: colors.textMuted },
  fee: { ...typography.caption, fontWeight: "700", fontFamily: FONT.bold, color: colors.textPrimary },
  trackerBlock: { paddingVertical: spacing.xs },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  status: { ...typography.small, color: colors.warning, backgroundColor: colors.warningBg, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  countdown: { ...typography.small, color: colors.textMuted },
});
