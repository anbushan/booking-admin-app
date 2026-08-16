import React, { useState, useEffect, useRef } from "react";
import { View, Text, SectionList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonSectionHeader, SkeletonCard } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { primeLocationIfNeeded } from "../lib/locationPriming";
import { UnreadBadge } from "../components/UnreadBadge";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";
import { groupByRide } from "../lib/groupByRide";
import { appEvents } from "../lib/appEvents";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

// The driver-side counterpart to "Booking requests" — once a request is
// accepted it disappears from that pending list, but nothing anywhere
// showed a confirmed booking again until it was time to actually start
// the trip. This is that missing screen: every confirmed/in-progress
// booking across all of a driver's rides, with the actual "start trip"
// action, reusing the same driver-active data the chat list already
// fetches (this just adds the trip-starting action on top of it).

type Trip = {
  id: string;
  status: string;
  seatsBooked: number;
  passenger?: { name: string; photoViewUrl?: string | null };
  ride?: { sourceAddress: string; destAddress: string; travelDate?: string };
  unreadMessageCount?: number;
};

export default function UpcomingTripsScreen({ navigation }: any) {
  useScreenView("UpcomingTripsScreen");
  const { t } = useTranslation();
  const [trips, setTrips] = useState<Trip[]>([]);
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
      .getDriverActiveBookings()
      .then((data: Trip[]) => setTrips(data.filter((t) => ["AWAITING_PAYMENT", "CONFIRMED", "IN_PROGRESS"].includes(t.status))))
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useFocusEffect(React.useCallback(() => { load(); }, []));

  // Live "chat:new" (see AppSocketBridge) keeps each card's unread-chat
  // badge current without needing to leave and come back to this screen.
  useEffect(() => appEvents.on("chat:new", () => load()), []);

  // A double-tap here used to push StartTripScreen twice — the button had
  // no debounce, and `navigation.navigate()` doesn't fully de-duplicate
  // two calls that land in the same tick before the first push's
  // transition has actually started. Each mounted instance independently
  // calls api.startTrip() (see StartTripScreen), which re-generates the
  // pickup OTP and re-notifies the passenger — so this wasn't just a
  // visual flicker from two screens transitioning back-to-back, it was a
  // second, silently-invalidating OTP generated behind the driver's back.
  // A plain ref (not state) is enough: it only needs to block a second
  // call within the same tap-to-navigation window, not trigger a
  // re-render, and resets once the screen refocuses (the user's back on
  // this list, so a fresh tap should work again).
  const navigatingRef = useRef(false);
  useFocusEffect(React.useCallback(() => { navigatingRef.current = false; }, []));

  function handleAction(trip: Trip) {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    if (trip.status === "CONFIRMED") {
      navigation.navigate("StartTrip", { bookingId: trip.id });
    } else {
      primeLocationIfNeeded(navigation, "ActiveTrip", { bookingId: trip.id, role: "DRIVER" });
    }
  }

  const sections = groupByRide(trips);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>{t("home.startTripNow")}</Text>

      {loading ? (
        <View style={{ flex: 1, paddingBottom: spacing.md }}>
          <SkeletonSectionHeader />
          <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        </View>
      ) : error ? (
        <ErrorState message={t("upcomingTrips.couldntLoad")} onRetry={load} />
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
            // Whole card opens the full booking detail — the explicit
            // Start/Continue/Chat buttons inside stay as their own
            // Pressables and still fire independently on their own tap.
            <Pressable style={styles.card} onPress={() => navigation.navigate("BookingDetail", { bookingId: item.id })}>
              <View style={styles.rowBetween}>
                <Text style={styles.meta}>{item.passenger?.name || t("register.passenger")} · {t("common.seatsCount", { count: item.seatsBooked })}</Text>
                <Text style={item.status === "IN_PROGRESS" ? styles.statusActive : item.status === "AWAITING_PAYMENT" ? styles.statusPending : styles.statusConfirmed}>
                  {item.status === "IN_PROGRESS" ? t("upcomingTrips.inProgress") : item.status === "AWAITING_PAYMENT" ? t("upcomingTrips.awaitingPayment") : t("status.confirmed")}
                </Text>
              </View>
              {item.status === "AWAITING_PAYMENT" ? (
                // Not actionable yet — the passenger hasn't paid the
                // platform fee, so there's nothing to start. Accepting a
                // request doesn't mean confirmed; this state makes that
                // visible instead of the booking just disappearing until
                // payment (or the pay window expiring) happens silently.
                <Text style={styles.pendingCaption}>{t("upcomingTrips.waitingForFee")}</Text>
              ) : (
                <View style={styles.actionRow}>
                  <Pressable style={[styles.actionButton, { flex: 1 }]} onPress={() => handleAction(item)}>
                    <Text style={styles.actionButtonText}>
                      {item.status === "IN_PROGRESS" ? t("upcomingTrips.continueTrip") : t("upcomingTrips.startTrip")}
                    </Text>
                  </Pressable>
                  {item.status === "CONFIRMED" && (
                    <Pressable
                      style={[styles.actionButton, styles.chatButton, { flexDirection: "row", alignItems: "center" }]}
                      onPress={() => navigation.navigate("ChatDetail", {
                        bookingId: item.id,
                        calleeRole: "PASSENGER",
                        // Already in memory (this row already shows the
                        // passenger's name) — see ChatDetailScreen's
                        // header comment for why this kills the flicker.
                        otherName: item.passenger?.name,
                        otherPhoto: item.passenger?.photoViewUrl,
                      })}
                    >
                      <Text style={styles.chatButtonText}>{t("history.chat")}</Text>
                      <UnreadBadge count={item.unreadMessageCount} />
                    </Pressable>
                  )}
                </View>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="navigate-outline"
              title={t("upcomingTrips.emptyTitle")}
              subtitle={t("upcomingTrips.emptySubtitle")}
            />
          }
        />
      )}
      <AppBottomNav navigation={navigation} profile={profile} active="menu" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm, paddingHorizontal: 2 },
  sectionTitle: { ...typography.title, fontSize: 13, color: colors.accentText },
  sectionSubtitle: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  meta: { ...typography.small, color: colors.textMuted },
  statusConfirmed: { ...typography.small, color: colors.accentText, backgroundColor: colors.accentBg, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  statusActive: { ...typography.small, color: colors.success, backgroundColor: colors.successBg, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  statusPending: { ...typography.small, color: colors.warning, backgroundColor: colors.warningBg, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  pendingCaption: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  actionButton: { backgroundColor: colors.textPrimary, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  actionButtonText: { ...typography.caption, color: "#FFFFFF", fontWeight: "700", fontFamily: FONT.bold },
  chatButton: { flex: 0, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chatButtonText: { ...typography.caption, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
});
