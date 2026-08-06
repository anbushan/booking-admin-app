import React, { useEffect, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonBlock } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";

type Earnings = {
  totalThisMonth: number;
  tripsCompleted: number;
  avgPerTrip: number;
  // amount is the remaining fare — the cash/UPI portion settled directly
  // with the passenger, since the platform fee never reaches the driver.
  recentTrips: { id: string; route: string; amount: number; status: string; cashCollected: boolean }[];
};

export default function EarningsScreen({ navigation }: any) {
  const [data, setData] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { showError } = useToast();

  function load() {
    setLoading(true);
    setError(false);
    api.getEarnings().then(setData).catch(() => setError(true)).finally(() => setLoading(false));
  }

  useEffect(load, []);

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
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>Earnings</Text>
      </View>

      {loading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <SkeletonBlock style={{ height: 100, borderRadius: radius.md }} />
          <SkeletonBlock style={{ height: 60, borderRadius: radius.sm }} />
        </View>
      ) : error ? (
        <ErrorState message="Couldn't load earnings." onRetry={load} />
      ) : (
        <>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>This month</Text>
            <Text style={styles.summaryValue}>Rs {data?.totalThisMonth ?? 0}</Text>
            <Text style={styles.summarySub}>{data?.tripsCompleted ?? 0} trips completed</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>Rs {data?.avgPerTrip ?? 0}</Text>
              <Text style={styles.statLabel}>Avg per trip</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Recent trips</Text>
          <FlatList
            data={data?.recentTrips || []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: spacing.lg }}
            renderItem={({ item }) => (
              <View style={styles.tripRow}>
                <Text style={styles.tripRoute}>{item.route}</Text>
                {item.cashCollected ? (
                  <Text style={styles.tripAmount}>+Rs {item.amount}</Text>
                ) : (
                  <Pressable onPress={() => markCollected(item.id)}>
                    <Text style={[styles.tripAmount, { color: colors.warning }]}>
                      Rs {item.amount} · mark collected
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
            ListEmptyComponent={<EmptyState title="No trips yet this month" />}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  back: { fontSize: 18 },
  title: typography.title,
  summaryCard: { backgroundColor: colors.surface, margin: spacing.lg, borderRadius: radius.md, padding: spacing.lg, alignItems: "center" },
  summaryLabel: { ...typography.small, color: colors.textMuted },
  summaryValue: { fontSize: 24, fontWeight: "500", marginTop: 4 },
  summarySub: { ...typography.small, color: colors.success, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginHorizontal: spacing.lg },
  statBox: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.md, alignItems: "center" },
  statValue: { fontSize: 16, fontWeight: "500" },
  statLabel: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  sectionLabel: { ...typography.title, fontSize: 13, marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.xs },
  tripRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  tripRoute: { ...typography.caption, flex: 1 },
  tripAmount: { ...typography.caption, color: colors.success },
});
