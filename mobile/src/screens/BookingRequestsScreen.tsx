import React, { useEffect, useState, useCallback } from "react";
import { View, Text, SectionList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { CarLoader } from "../components/CarLoader";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { Analytics } from "../lib/analytics";
import { StepTracker, bookingJourneySteps } from "../components/StepTracker";
import { AppBottomNav } from "../components/AppBottomNav";
import { SafeAreaView } from "react-native-safe-area-context";
import { groupByRide } from "../lib/groupByRide";
import { useScreenView } from "../lib/useScreenView";
import Avatar from "../components/Avatar";
import { useTranslation } from "../lib/i18n/I18nContext";

type BookingRequest = {
  id: string;
  passenger: { name: string; ratingAvg: number; photoViewUrl?: string | null };
  seatsBooked: number;
  isCustomPickup: boolean;
  pickupAddress: string;
  expiresAt: string;
  ride?: { id: string; sourceAddress: string; destAddress: string; travelDate?: string };
};

function minutesLeft(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.round(diff / 60000));
}

export default function BookingRequestsScreen({ route, navigation }: any) {
  useScreenView("BookingRequestsScreen");
  const { t } = useTranslation();
  const { rideId } = route.params || {};
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [, forceTick] = useState(0);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    api.getMyProfile().then(setProfile).catch(() => {});
  }, []);

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    const loadFn = rideId ? () => api.getRideBookings(rideId) : api.getDriverPendingRequests;
    loadFn().then(setRequests).catch(() => setError(true)).finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [rideId])
  );

  async function respond(bookingId: string, action: "accept" | "reject") {
    try {
      if (action === "accept") { await api.acceptBooking(bookingId); Analytics.bookingAccepted(bookingId); }
      else { await api.rejectBooking(bookingId); Analytics.bookingRejected(bookingId); }
      setRequests((prev) => prev.filter((r) => r.id !== bookingId));
      showSuccess(action === "accept" ? t("bookingRequests.acceptedToast") : t("bookingRequests.declinedToast"));
    } catch (err: any) {
      showError(err.message || t("bookingRequests.couldntUpdate"));
    }
  }

  const sections = groupByRide(requests);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>{rideId ? t("home.bookingRequests") : t("bookingRequests.allTitle")}</Text>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message={t("bookingRequests.couldntLoad")} onRetry={load} />
      ) : (
      <SectionList
        style={{ flex: 1 }}
        sections={sections}
        maxToRenderPerBatch={8}
        windowSize={7}
        initialNumToRender={8}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, flexGrow: 1 }}
        stickySectionHeadersEnabled={false}
        // Multiple requests for the exact same ride share one header —
        // that's the whole point (this is what "which trip is this
        // request even for" ambiguity looks like solved), so the
        // per-card route row that used to repeat the same route on
        // every single card underneath it is gone; the header already
        // says it once.
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Ionicons name="navigate-outline" size={13} color={colors.accentText} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable onPress={() => navigation.navigate("BookingRequestDetail", { request: item })}>
              <View style={styles.cardTop}>
                <Avatar uri={item.passenger?.photoViewUrl} name={item.passenger?.name} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.passengerName}>{item.passenger?.name || t("register.passenger")}</Text>
                  <Text style={styles.meta}>
                    <Ionicons name="star" size={10} color={colors.marigold} /> {(item.passenger?.ratingAvg ?? 0).toFixed(1)} · {t("common.seatsCount", { count: item.seatsBooked })}
                  </Text>
                </View>
                <View style={styles.countdown}>
                  <Ionicons name="time-outline" size={11} color={colors.warning} />
                  <Text style={styles.countdownText}>{t("common.minutesLeft", { mins: minutesLeft(item.expiresAt) })}</Text>
                </View>
              </View>
              <View style={styles.pickupRow}>
                <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                <Text style={styles.pickup}>
                  {item.isCustomPickup ? t("bookingRequests.customPickup", { address: item.pickupAddress }) : t("bookingRequests.defaultPickup")}
                </Text>
              </View>

              {/* Same journey view as the passenger sees on "My bookings"
                  — a request just sits at step one, but seeing it as the
                  start of the same line (not a standalone card) makes
                  what accepting actually does obvious. */}
              <View style={styles.trackerWrap}>
                <StepTracker steps={bookingJourneySteps("BOOKED", t)} />
              </View>
            </Pressable>
            <View style={styles.actionRow}>
              <Pressable style={styles.acceptButton} onPress={() => respond(item.id, "accept")}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.acceptText}>{t("driver.acceptBooking")}</Text>
              </Pressable>
              <Pressable style={styles.declineButton} onPress={() => respond(item.id, "reject")}>
                <Ionicons name="close" size={16} color={colors.textSecondary} />
                <Text style={styles.declineText}>{t("driver.declineBooking")}</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState icon="mail-open-outline" title={t("myRequests.emptyTitle")} subtitle={t("bookingRequests.emptySubtitle")} />
        }
      />
      )}
      <AppBottomNav navigation={navigation} profile={profile} active="requests" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm, paddingHorizontal: 2 },
  sectionTitle: { ...typography.title, fontSize: 13, color: colors.accentText },
  sectionSubtitle: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  cardTop: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  passengerName: { ...typography.title, fontSize: 14 },
  meta: { ...typography.small, color: colors.textMuted },
  countdown: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.warningBg, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 999 },
  countdownText: { ...typography.small, color: colors.warning, fontWeight: "700", fontFamily: FONT.bold },
  pickupRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.sm },
  pickup: { ...typography.small, color: colors.textSecondary },
  trackerWrap: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  acceptButton: { flex: 1, flexDirection: "row", gap: 6, backgroundColor: colors.textPrimary, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  acceptText: { ...typography.caption, color: "#FFFFFF", fontWeight: "700", fontFamily: FONT.bold },
  declineButton: { flex: 1, flexDirection: "row", gap: 6, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  declineText: { ...typography.caption, color: colors.textSecondary, fontWeight: "700", fontFamily: FONT.bold },
});
