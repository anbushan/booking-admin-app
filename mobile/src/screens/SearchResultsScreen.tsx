import React, { useMemo, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonCardList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";
import SearchOptionsModal, { formatSearchDate } from "../components/SearchOptionsModal";
import { RouteTimeline } from "../components/RouteTimeline";
import { RouteMiniMap } from "../components/RouteMiniMap";
import { useScreenView } from "../lib/useScreenView";
import Avatar from "../components/Avatar";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { RidePreferences } from "../components/RidePreferences";
import { useTranslation } from "../lib/i18n/I18nContext";
import { formatInr } from "../lib/money";

type RideResult = {
  id: string;
  driver: { name: string; ratingAvg: number; photoViewUrl?: string | null };
  vehicle?: { make: string; model: string; seatCapacity: number | null } | null;
  driverVerified?: boolean;
  pricePerSeat: string;
  // What this passenger actually owes per seat for their own matched
  // segment, not the ride's full-route price — see rides.routes.js
  // GET /search. Always present (falls back to the full pricePerSeat
  // server-side for a legacy/no-route ride), but optional here too so a
  // stale cached response from before this shipped still renders.
  segmentPricePerSeat?: number;
  seatsAvailable: number;
  seatsFull?: boolean;
  isOwnRide?: boolean;
  travelDate: string;
  sourceAddress: string;
  destAddress: string;
  sourceLat: number;
  sourceLng: number;
  destLat: number;
  destLng: number;
  routePolyline?: string | null;
  estimatedArrivalAt: string;
  estimatedDurationMinutes: number;
  preferences?: Record<string, boolean> | null;
};

type SortKey = "earliest" | "cheapest" | "rated";

const SORT_OPTIONS: { key: SortKey; labelKey: string }[] = [
  { key: "earliest", labelKey: "search.earliest" },
  { key: "cheapest", labelKey: "search.cheapest" },
  { key: "rated", labelKey: "search.topRated" },
];

// One card's mini map + its own Traffic/Weather toggles — its own
// component (not inlined in renderItem) purely so each card gets its
// own independent hook state; one person's toggle shouldn't flip every
// other result's map too. FlatList windowing (see maxToRenderPerBatch/
// windowSize below) keeps how many of these are actually mounted at
// once bounded, the same way any other card content on this screen is.
function RideResultCard({
  item, navigation, sourceLat, sourceLng, sourceAddress, destLat, destLng, destAddress, t,
}: {
  item: RideResult;
  navigation: any;
  sourceLat: number;
  sourceLng: number;
  sourceAddress: string;
  destLat?: number;
  destLng?: number;
  destAddress?: string;
  t: (key: string, params?: any) => string;
}) {
  return (
    <Pressable
      style={[styles.card, (item.seatsFull || item.isOwnRide) && styles.cardFull]}
      onPress={() => {
        if (item.seatsFull || item.isOwnRide) return;
        // Carries the passenger's own searched pickup/drop through to
        // the booking screen — previously only rideId went across, so
        // the booking always silently defaulted to the ride's full
        // source/destination regardless of what was actually searched
        // and matched here.
        navigation.navigate("BookingConfirm", {
          rideId: item.id,
          pickupLat: sourceLat,
          pickupLng: sourceLng,
          pickupAddress: sourceAddress,
          ...(destLat != null && destLng != null
            ? { dropLat: destLat, dropLng: destLng, dropAddress: destAddress }
            : {}),
        });
      }}
    >
      <View style={styles.cardTop}>
        <Avatar uri={item.driver?.photoViewUrl} name={item.driver?.name} size={40} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.driverName}>{item.driver?.name || t("common.driverFallback")}</Text>
            <VerifiedBadge verified={!!item.driverVerified} size="sm" />
          </View>
          <Text style={styles.meta}>
            <Ionicons name="star" size={11} color={colors.marigold} /> {(item.driver?.ratingAvg ?? 0).toFixed(1)}
            {item.vehicle ? `  ·  ${item.vehicle.make} ${item.vehicle.model}` : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.price}>Rs {formatInr(item.segmentPricePerSeat ?? item.pricePerSeat)}</Text>
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
      {item.preferences && (
        <View style={styles.preferencesWrap}>
          <RidePreferences preferences={item.preferences} size="sm" />
        </View>
      )}

      <View style={{ marginTop: spacing.sm }}>
        <RouteMiniMap
          sourceLat={item.sourceLat}
          sourceLng={item.sourceLng}
          destLat={item.destLat}
          destLng={item.destLng}
          routePolyline={item.routePolyline}
          height={150}
        />
      </View>

      <View style={styles.timelineWrap}>
        <RouteTimeline
          departAt={item.travelDate}
          arriveAt={item.estimatedArrivalAt}
          durationMinutes={item.estimatedDurationMinutes}
          sourceAddress={item.sourceAddress}
          destAddress={item.destAddress}
        />
        {/* The card itself has always navigated to BookingConfirm on tap
            (see the outer Pressable above) — this button doesn't change
            that, it just makes it explicit. Now that each card also
            holds a real interactive map (pan/zoom, Traffic/Weather
            toggles), "tap anywhere to proceed" reads more like "tap
            anywhere to interact with the map" than a clear next step —
            a labeled button says plainly what happens and where it
            leads, matching every other "here's what this does" button
            already in this app rather than relying on implicit
            whole-card tap. */}
        {!item.seatsFull && !item.isOwnRide && (
          <Pressable
            style={styles.detailsButton}
            onPress={() => navigation.navigate("BookingConfirm", {
              rideId: item.id,
              pickupLat: sourceLat,
              pickupLng: sourceLng,
              pickupAddress: sourceAddress,
              ...(destLat != null && destLng != null
                ? { dropLat: destLat, dropLng: destLng, dropAddress: destAddress }
                : {}),
            })}
          >
            <Text style={styles.detailsButtonText}>{t("search.viewDetails")}</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

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
      sorted.sort((a, b) => Number(a.segmentPricePerSeat ?? a.pricePerSeat) - Number(b.segmentPricePerSeat ?? b.pricePerSeat));
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
        <SkeletonCardList />
      ) : error ? (
        <ErrorState message={t("search.couldntLoadRides")} onRetry={load} />
      ) : (
        <FlatList
          data={filteredSorted}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
          keyExtractor={(item) => item.id}
          maxToRenderPerBatch={8}
          windowSize={7}
          initialNumToRender={8}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
          renderItem={({ item }) => (
            <RideResultCard
              item={item}
              navigation={navigation}
              sourceLat={sourceLat}
              sourceLng={sourceLng}
              sourceAddress={sourceAddress}
              destLat={destLat}
              destLng={destLng}
              destAddress={destAddress}
              t={t}
            />
          )}
          ListEmptyComponent={
            <EmptyState title={t("search.noRidesFound")} subtitle={t("search.noRidesSubtitle")} size="large" />
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
  sortChipTextActive: { color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cardFull: { opacity: 0.55 },
  cardTop: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  preferencesWrap: { marginTop: spacing.sm },
  timelineWrap: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  detailsButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: colors.textPrimary, height: 40, borderRadius: radius.sm, marginTop: spacing.sm,
  },
  detailsButtonText: { ...typography.caption, color: "#FFFFFF", fontWeight: "700", fontFamily: FONT.bold },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  driverName: { ...typography.title, fontSize: 14 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: colors.successBg, borderRadius: 4, paddingVertical: 1, paddingHorizontal: 5 },
  verifiedBadgeText: { fontSize: 10, color: colors.success, fontWeight: "700", fontFamily: FONT.bold },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  price: { ...typography.title, color: colors.textPrimary, fontVariant: ["tabular-nums"] },
  seatsPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.successBg, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6, marginTop: spacing.xs },
  seatsPillFull: { backgroundColor: colors.dangerBg },
  seatsPillText: { fontSize: 10, fontWeight: "700", fontFamily: FONT.bold },
});
