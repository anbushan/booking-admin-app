import React, { useMemo, useState, useCallback } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { CarLoader } from "../components/CarLoader";
import { NoRidesFound } from "../components/NoRidesFound";
import { ErrorState } from "../components/ErrorState";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";
import SearchOptionsModal, { formatSearchDate } from "../components/SearchOptionsModal";
import { RouteTimeline } from "../components/RouteTimeline";

type RideResult = {
  id: string;
  driver: { name: string; ratingAvg: number };
  vehicle?: { make: string; model: string; seatCapacity: number | null } | null;
  driverVerified?: boolean;
  pricePerSeat: string;
  seatsAvailable: number;
  seatsFull?: boolean;
  travelDate: string;
  sourceAddress: string;
  destAddress: string;
  estimatedArrivalAt: string;
  estimatedDurationMinutes: number;
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
    destLat,
    destLng,
    destAddress = "",
    date = new Date().toISOString(),
    seats = 1,
  } = route.params || {};

  const [rides, setRides] = useState<RideResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [sort, setSort] = useState<SortKey>("earliest");
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [searchDate, setSearchDate] = useState(new Date(date));
  const [timeRange, setTimeRange] = useState<{ startTime?: string; endTime?: string }>({});

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    api
      .searchRides({ sourceLat, sourceLng, destLat, destLng, date: searchDate.toISOString(), seats, ...timeRange })
      .then((data) => { setRides(data); Analytics.searchRides({ seats }); })
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useFocusEffect(useCallback(load, [searchDate, timeRange]));

  const filteredSorted = useMemo(() => {
    const sorted = [...rides];
    if (sort === "cheapest") {
      sorted.sort((a, b) => Number(a.pricePerSeat) - Number(b.pricePerSeat));
    } else if (sort === "rated") {
      sorted.sort((a, b) => (b.driver?.ratingAvg ?? 0) - (a.driver?.ratingAvg ?? 0));
    } else {
      sorted.sort((a, b) => new Date(a.travelDate).getTime() - new Date(b.travelDate).getTime());
    }
    // Full rides are still shown (the search endpoint no longer hides
    // them) but sink to the bottom regardless of sort, so an available
    // ride is never buried under full ones.
    sorted.sort((a, b) => Number(!!a.seatsFull) - Number(!!b.seatsFull));
    return sorted;
  }, [rides, sort]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle} numberOfLines={1}>{sourceAddress}{destAddress ? ` to ${destAddress}` : ""}</Text>
          <Text style={styles.pageSubtitle} numberOfLines={1}>
            {formatSearchDate(searchDate)}{timeRange.startTime ? ` · ${timeRange.startTime}–${timeRange.endTime}` : ""} · {seats} seat{seats === 1 ? "" : "s"}
          </Text>
        </View>
        <Pressable style={styles.filterButton} onPress={() => setOptionsVisible(true)}>
          <Ionicons name="options-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.filterButtonText}>Filters</Text>
        </Pressable>
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
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message="Couldn't load rides." onRetry={load} />
      ) : (
        <FlatList
          data={filteredSorted}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, item.seatsFull && styles.cardFull]}
              onPress={() => {
                if (item.seatsFull) return;
                navigation.navigate("BookingConfirm", { rideId: item.id });
              }}
            >
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(item.driver?.name || "?").charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.driverName}>{item.driver?.name || "Driver"}</Text>
                    {item.driverVerified && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={11} color={colors.success} />
                        <Text style={styles.verifiedBadgeText}>Verified</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.meta}>
                    <Ionicons name="star" size={11} color={colors.marigold} /> {(item.driver?.ratingAvg ?? 0).toFixed(1)}
                    {item.vehicle ? `  ·  ${item.vehicle.make} ${item.vehicle.model}` : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.price}>Rs {item.pricePerSeat}</Text>
                  <View style={[styles.seatsPill, item.seatsFull && styles.seatsPillFull]}>
                    <Ionicons
                      name={item.seatsFull ? "close-circle" : "people"}
                      size={11}
                      color={item.seatsFull ? colors.danger : colors.success}
                    />
                    <Text style={[styles.seatsPillText, { color: item.seatsFull ? colors.danger : colors.success }]}>
                      {item.seatsFull ? "Full" : `${item.seatsAvailable} left`}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.timelineWrap}>
                <RouteTimeline
                  departAt={item.travelDate}
                  arriveAt={item.estimatedArrivalAt}
                  durationMinutes={item.estimatedDurationMinutes}
                  sourceAddress={item.sourceAddress}
                  destAddress={item.destAddress}
                />
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <NoRidesFound title="No rides found" subtitle="Try a different date or check back later." />
          }
        />
      )}

      <SearchOptionsModal
        visible={optionsVisible}
        rangeMode
        initialDate={searchDate}
        initialSeats={seats}
        onClose={() => setOptionsVisible(false)}
        onConfirm={(newDate, _newSeats, startTime, endTime) => {
          setSearchDate(newDate);
          setTimeRange({ startTime, endTime });
          setOptionsVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  pageTitle: { ...typography.title },
  pageSubtitle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  filterButton: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  filterButtonText: { ...typography.small, color: colors.textSecondary },
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
  cardFull: { opacity: 0.55 },
  cardTop: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center", flex: 0 },
  avatarText: { ...typography.title, color: colors.accentText, fontSize: 13 },
  timelineWrap: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  driverName: { ...typography.title, fontSize: 14 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: colors.successBg, borderRadius: 4, paddingVertical: 1, paddingHorizontal: 5 },
  verifiedBadgeText: { fontSize: 10, color: colors.success, fontWeight: "500" },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  price: { ...typography.title, color: colors.textPrimary, fontVariant: ["tabular-nums"] },
  seatsPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.successBg, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6, marginTop: 4 },
  seatsPillFull: { backgroundColor: colors.dangerBg },
  seatsPillText: { fontSize: 10, fontWeight: "700" },
});
