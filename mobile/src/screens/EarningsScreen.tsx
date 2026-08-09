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
  // amount is the remaining fare — the cash/UPI portion settled directly
  // with the passenger, since the platform fee never reaches the driver.
  recentTrips: {
    id: string; route: string; amount: number; status: string; cashCollected: boolean;
    passengerId: string; passengerName: string | null;
  }[];
};

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
            <View style={styles.summaryIconWrap}>
              <Ionicons name="wallet-outline" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.summaryLabel}>This month</Text>
            <Text style={styles.summaryValue}>Rs {data?.totalThisMonth ?? 0}</Text>
            <Text style={styles.summarySub}>{data?.tripsCompleted ?? 0} trips completed</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Ionicons name="trending-up-outline" size={16} color={colors.accentText} />
              <Text style={styles.statValue}>Rs {data?.avgPerTrip ?? 0}</Text>
              <Text style={styles.statLabel}>Avg per trip</Text>
            </View>
          </View>

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
                <View style={styles.tripTopRow}>
                  <View style={styles.tripIconWrap}>
                    <Ionicons name="car-outline" size={14} color={colors.textSecondary} />
                  </View>
                  <Text style={styles.tripRoute}>{item.route}</Text>
                  {item.cashCollected ? (
                    <Text style={styles.tripAmount}>+Rs {item.amount}</Text>
                  ) : (
                    <Pressable style={styles.collectChip} onPress={() => markCollected(item.id)}>
                      <Ionicons name="cash-outline" size={12} color={colors.warning} />
                      <Text style={[styles.tripAmount, { color: colors.warning }]}>
                        Rs {item.amount} · mark collected
                      </Text>
                    </Pressable>
                  )}
                </View>
                {/* Only the most recent trip (index 0 — recentTrips is
                    ordered newest first) offers feedback. Rating an older
                    entry days later isn't useful and just clutters this
                    list with stale actions. */}
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
  summaryCard: { backgroundColor: colors.surface, margin: spacing.lg, borderRadius: radius.md, padding: spacing.lg, alignItems: "center" },
  summaryIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.textPrimary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  summaryLabel: { ...typography.small, color: colors.textMuted },
  summaryValue: { fontSize: 24, fontWeight: "700", marginTop: 4 },
  summarySub: { ...typography.small, color: colors.success, marginTop: 2 },
  notice: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: colors.accentBg, borderRadius: radius.sm, padding: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.md },
  noticeText: { ...typography.small, color: colors.accentText, flex: 1, lineHeight: 17 },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginHorizontal: spacing.lg },
  statBox: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.md, alignItems: "center", gap: 2 },
  statValue: { fontSize: 16, fontWeight: "700" },
  statLabel: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  sectionLabel: { ...typography.title, fontSize: 13, marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.xs },
  tripRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.xs },
  tripTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs },
  tripIconWrap: { width: 24, height: 24, borderRadius: 8, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  tripRoute: { ...typography.caption, flex: 1 },
  tripAmount: { ...typography.caption, color: colors.success },
  collectChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  rateLink: { ...typography.small, color: colors.accentText },
});
