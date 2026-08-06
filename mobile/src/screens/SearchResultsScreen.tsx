import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, RefreshControl } from "react-native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatSearchDate } from "../components/SearchOptionsModal";

type RideResult = {
  id: string;
  driver: { name: string; ratingAvg: number };
  pricePerSeat: string;
  seatsAvailable: number;
  travelDate: string;
};

type SortKey = "earliest" | "cheapest" | "rated";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "earliest", label: "Earliest" },
  { key: "cheapest", label: "Cheapest" },
  { key: "rated", label: "Top rated" },
];

export default function SearchResultsScreen({ navigation, route }: any) {
  const {
    sourceLat = 12.9352,
    sourceLng = 77.6146,
    sourceAddress = "Koramangala, Bengaluru",
    destAddress = "",
    date = new Date().toISOString(),
    seats = 1,
  } = route.params || {};

  const [rides, setRides] = useState<RideResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [sort, setSort] = useState<SortKey>("earliest");
  const [minSeats] = useState(seats);

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    api
      .searchRides({ sourceLat, sourceLng, date, seats })
      .then((data) => { setRides(data); Analytics.searchRides({ seats }); })
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(load, []);

  const filteredSorted = useMemo(() => {
    const filtered = rides.filter((r) => r.seatsAvailable >= minSeats);
    const sorted = [...filtered];
    if (sort === "cheapest") {
      sorted.sort((a, b) => Number(a.pricePerSeat) - Number(b.pricePerSeat));
    } else if (sort === "rated") {
      sorted.sort((a, b) => (b.driver?.ratingAvg ?? 0) - (a.driver?.ratingAvg ?? 0));
    } else {
      sorted.sort((a, b) => new Date(a.travelDate).getTime() - new Date(b.travelDate).getTime());
    }
    return sorted;
  }, [rides, sort, minSeats]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>
            {sourceAddress}{destAddress ? ` to ${destAddress}` : ""}
          </Text>
          <Text style={styles.subtitle}>
            {formatSearchDate(new Date(date))} · {seats} seat{seats === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={[styles.sortChip, sort === opt.key && styles.sortChipActive]}
            onPress={() => setSort(opt.key)}
          >
            <Text style={[styles.sortChipText, sort === opt.key && styles.sortChipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <SkeletonList count={4} />
      ) : error ? (
        <ErrorState message="Couldn't load rides." onRetry={load} />
      ) : (
        <FlatList
          data={filteredSorted}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate("BookingConfirm", { rideId: item.id })}
            >
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.driverName}>{item.driver?.name || "Driver"}</Text>
                  <Text style={styles.meta}>
                    {(item.driver?.ratingAvg ?? 0).toFixed(1)} rating · {item.seatsAvailable} seats left
                  </Text>
                </View>
                <Text style={styles.price}>Rs {item.pricePerSeat}</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState title="No rides found" subtitle="Try a different date or check back later." />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: { fontSize: 18 },
  title: typography.title,
  subtitle: { ...typography.small, color: colors.textMuted },
  sortRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  sortChip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: colors.bg },
  sortChipActive: { backgroundColor: colors.accentBg },
  sortChipText: { ...typography.small, color: colors.textSecondary },
  sortChipTextActive: { color: colors.accentText, fontWeight: "500" },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  driverName: { ...typography.title, fontSize: 14 },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  price: { ...typography.title, color: colors.success },
});
