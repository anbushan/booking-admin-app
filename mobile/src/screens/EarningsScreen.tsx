import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { CarLoader } from "../components/CarLoader";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";

type Earnings = {
  totalThisMonth: number;
  tripsCompleted: number;
  avgPerTrip: number;
  pendingCollectionAmount: number;
  pendingCollectionCount: number;
  // amount is the remaining fare — the cash/UPI portion settled directly
  // with the passenger, since the platform fee never reaches the driver.
  recentTrips: {
    id: string; route: string; amount: number; status: string; cashCollected: boolean;
    completedAt: string | null; passengerId: string; passengerName: string | null;
  }[];
};

function formatTripDate(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfTarget - startOfToday) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function EarningsScreen({ navigation }: any) {
  const [data, setData] = useState<Earnings | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const { showError } = useToast();

  useEffect(() => {
    api.getMyProfile().then(setProfile).catch(() => {});
  }, []);

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    api.getEarnings().then(setData).catch(() => setError(true)).finally(() => { setLoading(false); setRefreshing(false); });
  }

  useFocusEffect(useCallback(load, []));

  async function markCollected(bookingId: string) {
    try {
      await api.collectCash(bookingId);
      load();
    } catch (err: any) {
      showError(err.message || "Couldn't update");
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>Earnings</Text>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message="Couldn't load earnings." onRetry={load} />
      ) : (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryTopRow}>
              <View style={styles.summaryIconWrap}>
                <Ionicons name="wallet" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>Earned this month</Text>
                <Text style={styles.summaryValue}>Rs {data?.totalThisMonth ?? 0}</Text>
              </View>
            </View>
            <View style={styles.summaryStatsRow}>
              <View style={styles.summaryStat}>
                <Ionicons name="checkmark-done-outline" size={14} color="#FFFFFF" />
                <Text style={styles.summaryStatText}>{data?.tripsCompleted ?? 0} trips completed</Text>
              </View>
              <View style={styles.summaryStat}>
                <Ionicons name="trending-up-outline" size={14} color="#FFFFFF" />
                <Text style={styles.summaryStatText}>Rs {data?.avgPerTrip ?? 0} avg / trip</Text>
              </View>
            </View>
          </View>

          {/* Cash/UPI already earned but not yet marked collected — the
              thing a driver most needs to act on, so it gets its own
              prominent, warning-toned banner instead of blending into
              the trip list below where it's easy to miss. */}
          {!!data?.pendingCollectionAmount && data.pendingCollectionAmount > 0 && (
            <View style={styles.pendingBanner}>
              <View style={styles.pendingIconWrap}>
                <Ionicons name="cash-outline" size={18} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingTitle}>Rs {data.pendingCollectionAmount} yet to collect</Text>
                <Text style={styles.pendingSub}>
                  {data.pendingCollectionCount} trip{data.pendingCollectionCount === 1 ? "" : "s"} where you haven't marked cash/UPI as collected
                </Text>
              </View>
            </View>
          )}

          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={16} color={colors.accentText} />
            <Text style={styles.noticeText}>
              These are cash/UPI amounts collected directly from passengers — the platform fee
              they pay upfront isn't included here.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Recent trips</Text>
          <FlatList
            style={{ flex: 1 }}
            data={data?.recentTrips || []}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, flexGrow: 1 }}
            renderItem={({ item, index }) => (
              // Whole row opens the full booking detail — "mark
              // collected" and "Rate passenger" stay their own
              // Pressables and still fire independently on their own tap.
              <Pressable style={styles.tripRow} onPress={() => navigation.navigate("BookingDetail", { bookingId: item.id })}>
                <View style={styles.tripIconWrap}>
                  <Ionicons name="car-outline" size={16} color={colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.tripTopRow}>
                    <Text style={styles.tripRoute} numberOfLines={1}>{item.route}</Text>
                    <Text style={styles.tripDate}>{formatTripDate(item.completedAt)}</Text>
                  </View>
                  <Text style={styles.tripPassenger} numberOfLines={1}>{item.passengerName || "Passenger"}</Text>
                  <View style={styles.tripBottomRow}>
                    {item.cashCollected ? (
                      <View style={styles.collectedChip}>
                        <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                        <Text style={styles.collectedText}>Rs {item.amount} collected</Text>
                      </View>
                    ) : (
                      <Pressable style={styles.collectChip} onPress={() => markCollected(item.id)}>
                        <Ionicons name="cash-outline" size={12} color={colors.warning} />
                        <Text style={styles.collectChipText}>Rs {item.amount} · mark collected</Text>
                      </Pressable>
                    )}
                    {/* Only the most recent trip (index 0 — recentTrips
                        is ordered newest first) offers feedback. Rating
                        an older entry days later isn't useful and just
                        clutters this list with stale actions. */}
                    {index === 0 && (
                      <Pressable
                        onPress={() =>
                          navigation.navigate("RateReview", {
                            bookingId: item.id,
                            toUserId: item.passengerId,
                            toUserName: item.passengerName || "your passenger",
                          })
                        }
                      >
                        <Text style={styles.rateLink}>Rate {item.passengerName || "passenger"}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={<EmptyState icon="wallet-outline" title="No trips yet this month" />}
          />
        </>
      )}
      <AppBottomNav navigation={navigation} profile={profile} active="menu" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  summaryCard: { backgroundColor: colors.textPrimary, margin: spacing.lg, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  summaryTopRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  summaryIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  summaryLabel: { ...typography.small, color: "rgba(255,255,255,0.7)" },
  summaryValue: { fontSize: 26, fontWeight: "700", color: "#FFFFFF", marginTop: 2 },
  summaryStatsRow: { flexDirection: "row", gap: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.14)" },
  summaryStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  summaryStatText: { ...typography.small, color: "rgba(255,255,255,0.85)" },
  pendingBanner: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: colors.warningBg, borderRadius: radius.sm, padding: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  pendingIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  pendingTitle: { ...typography.caption, fontWeight: "700", color: colors.warning },
  pendingSub: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  notice: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: colors.accentBg, borderRadius: radius.sm, padding: spacing.md, marginHorizontal: spacing.lg },
  noticeText: { ...typography.small, color: colors.accentText, flex: 1, lineHeight: 17 },
  sectionLabel: { ...typography.title, fontSize: 13, marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.xs },
  tripRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  tripTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs },
  tripBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs, marginTop: 4 },
  tripIconWrap: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", marginTop: 2 },
  tripRoute: { ...typography.caption, fontWeight: "700", flex: 1 },
  tripDate: { ...typography.small, color: colors.textMuted },
  tripPassenger: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  collectedChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.successBg, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  collectedText: { ...typography.small, color: colors.success, fontWeight: "700" },
  collectChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.warningBg, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  collectChipText: { ...typography.small, color: colors.warning, fontWeight: "700" },
  rateLink: { ...typography.small, color: colors.accentText, fontWeight: "700" },
});
