import React, { useMemo, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
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
import { useScreenView } from "../lib/useScreenView";
import Avatar from "../components/Avatar";
import { useTranslation } from "../lib/i18n/I18nContext";

type RideResult = {
  id: string;
  driver: { name: string; ratingAvg: number; photoViewUrl?: string | null };
  vehicle?: { make: string; model: string; seatCapacity: number | null } | null;
  driverVerified?: boolean;
  pricePerSeat: string;
  seatsAvailable: number;
  seatsFull?: boolean;
  isOwnRide?: boolean;
  travelDate: string;
  sourceAddress: string;
  destAddress: string;
  estimatedArrivalAt: string;
  estimatedDurationMinutes: number;
};

type SortKey = "earliest" | "cheapest" | "rated";

const SORT_OPTIONS: { key: SortKey; labelKey: string }[] = [
  { key: "earliest", labelKey: "search.earliest" },
  { key: "cheapest", labelKey: "search.cheapest" },
  { key: "rated", labelKey: "search.topRated" },
];

export default function SearchResultsScreen({ navigation, route }: any) {
  useScreenView("SearchResultsScreen");
  const { t } = useTranslation();
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
    // Full rides — and a driver's own read-only ride — are still shown
    // (the search endpoint no longer hides either) but sink to the
    // bottom regardless of sort, so an actually-bookable ride is never
    // buried under ones that aren't.
    sorted.sort((a, b) => Number(!!a.seatsFull || !!a.isOwnRide) - Number(!!b.seatsFull || !!b.isOwnRide));
    return sorted;
  }, [rides, sort]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.titleRow}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle} numberOfLines={1}>{destAddress ? t("common.routeTo", { source: sourceAddress, dest: destAddress }) : sourceAddress}</Text>
          <Text style={styles.pageSubtitle} numberOfLines={1}>
            {formatSearchDate(searchDate, t)}{timeRange.startTime ? ` · ${timeRange.startTime}–${timeRange.endTime}` : ""} · {t("common.seatsCount", { count: seats })}
          </Text>
        </View>
        <Pressable style={styles.filterButton} onPress={() => setOptionsVisible(true)}>
          <Ionicons name="options-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.filterButtonText}>{t("search.filters")}</Text>
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
              {t(opt.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message={t("search.couldntLoadRides")} onRetry={load} />
      ) : (
        <FlatList
          data={filteredSorted}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, (item.seatsFull || item.isOwnRide) && styles.cardFull]}
              onPress={() => {
                if (item.seatsFull || item.isOwnRide) return;
                navigation.navigate("BookingConfirm", { rideId: item.id });
              }}
            >
              <View style={styles.cardTop}>
                <Avatar uri={item.driver?.photoViewUrl} name={item.driver?.name} size={40} />
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.driverName}>{item.driver?.name || t("common.driverFallback")}</Text>
                    {item.driverVerified && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={11} color={colors.success} />
                        <Text style={styles.verifiedBadgeText}>{t("common.verified")}</Text>
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
                  {item.isOwnRide ? (
                    <View style={[styles.seatsPill, styles.seatsPillFull]}>
                      <Ionicons name="person-circle-outline" size={11} color={colors.danger} />
                      <Text style={[styles.seatsPillText, { color: colors.danger }]}>{t("search.yourRide")}</Text>
                    </View>
                  ) : (
                    <View style={[styles.seatsPill, item.seatsFull && styles.seatsPillFull]}>
                      <Ionicons
                        name={item.seatsFull ? "close-circle" : "people"}
                        size={11}
                        color={item.seatsFull ? colors.danger : colors.success}
                      />
                      <Text style={[styles.seatsPillText, { color: item.seatsFull ? colors.danger : colors.success }]}>
                        {item.seatsFull ? t("search.full") : t("search.seatsLeft", { count: item.seatsAvailable })}
                      </Text>
                    </View>
                  )}
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
            <NoRidesFound title={t("search.noRidesFound")} subtitle={t("search.noRidesSubtitle")} />
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
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingLeft: spacing.xs, paddingRight: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginTop: 2 },
  pageTitle: { ...typography.title },
  pageSubtitle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  filterButton: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  filterButtonText: { ...typography.small, color: colors.textSecondary },
  sortRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  sortChip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: colors.bg },
  sortChipActive: { backgroundColor: colors.accentBg },
  sortChipText: { ...typography.small, color: colors.textSecondary },
  sortChipTextActive: { color: colors.accentText, fontWeight: "700" },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cardFull: { opacity: 0.55 },
  cardTop: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  timelineWrap: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  driverName: { ...typography.title, fontSize: 14 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: colors.successBg, borderRadius: 4, paddingVertical: 1, paddingHorizontal: 5 },
  verifiedBadgeText: { fontSize: 10, color: colors.success, fontWeight: "700" },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  price: { ...typography.title, color: colors.textPrimary, fontVariant: ["tabular-nums"] },
  seatsPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.successBg, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6, marginTop: 4 },
  seatsPillFull: { backgroundColor: colors.dangerBg },
  seatsPillText: { fontSize: 10, fontWeight: "700" },
});
