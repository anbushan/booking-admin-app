import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { CarLoader } from "../components/CarLoader";
import { ErrorState } from "../components/ErrorState";
import { RouteTimeline } from "../components/RouteTimeline";
import { RouteStopsList } from "../components/RouteStopsList";
import { RouteMiniMap } from "../components/RouteMiniMap";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import Avatar from "../components/Avatar";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { RidePreferences } from "../components/RidePreferences";
import { useTranslation } from "../lib/i18n/I18nContext";
import { formatInr } from "../lib/money";

type RideDetails = {
  id: string;
  sourceAddress: string;
  destAddress: string;
  sourceLat: number;
  sourceLng: number;
  destLat: number;
  destLng: number;
  routePolyline?: string | null;
  pricePerSeat: string;
  // What THIS passenger actually owes per seat for their own matched
  // pickup->drop, not the ride's full-route price — see
  // rides.routes.js GET /:id/details. Falls back to the full ride price
  // server-side whenever no segment could be resolved, so this is always
  // present and always the right number to charge/display.
  segmentPricePerSeat: number;
  seatsAvailable: number;
  driver?: { id: string; name: string; ratingAvg?: number; photoViewUrl?: string | null };
  driverVerified?: boolean;
  licenseVerified?: boolean;
  rcVerified?: boolean;
  travelDate: string;
  estimatedArrivalAt: string;
  estimatedDurationMinutes: number;
  routeStops?: { lat: number; lng: number; placeName: string; distanceKm: number; durationMinutes: number }[] | null;
  preferences?: Record<string, boolean> | null;
};

export default function BookingConfirmScreen({ route, navigation }: any) {
  useScreenView("BookingConfirmScreen");
  const { t } = useTranslation();
  // Explicit, on top of whatever SafeAreaView's own edges=["bottom"]
  // already accounts for — this app runs edge-to-edge on Android
  // (app.json), so the CTA in the sticky footer below needs to clear
  // the gesture/button navigation bar with real room, not just
  // technically not-underneath it.
  const insets = useSafeAreaInsets();
  const {
    rideId,
    // The passenger's own searched/matched pickup & drop (see
    // SearchResultsScreen) — absent when this screen was reached some
    // other way (e.g. a driver previewing their own ride), in which case
    // everything below falls back to the ride's own source/destination,
    // exactly the old behavior.
    pickupLat, pickupLng, pickupAddress,
    dropLat, dropLng, dropAddress,
  } = route.params;
  const [ride, setRide] = useState<RideDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [seats, setSeats] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  // What other passengers have said about this specific driver — shown
  // right here so it can actually inform the decision to book, not just
  // linked out to a profile the passenger has to remember to go check.
  const [driverReviews, setDriverReviews] = useState<any[]>([]);

  function load() {
    setLoading(true);
    setError(false);
    api
      .getRideDetails(
        rideId,
        pickupLat != null ? { lat: pickupLat, lng: pickupLng } : undefined,
        dropLat != null ? { lat: dropLat, lng: dropLng } : undefined
      )
      .then((data) => {
        setRide(data);
        // Default to 1 seat, or 0 if the ride is already full — never
        // default to a count higher than what's actually left.
        setSeats(data.seatsAvailable > 0 ? 1 : 0);
        if (data.driver?.id) {
          api.getReviewsForUser(data.driver.id).then(setDriverReviews).catch(() => setDriverReviews([]));
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useFocusEffect(useCallback(load, [rideId]));

  const full = !!ride && ride.seatsAvailable <= 0;
  const fare = ride ? Number(ride.segmentPricePerSeat ?? ride.pricePerSeat) * seats : 0;

  function adjustSeats(delta: number) {
    if (!ride) return;
    setSeats((s) => Math.max(1, Math.min(ride.seatsAvailable, 8, s + delta)));
  }

  async function handleRequestBooking() {
    if (!ride || full) return;
    setSubmitting(true);
    try {
      await api.createBooking({
        rideId,
        seatsBooked: seats,
        // Falls back to the ride's own source point only when this
        // screen genuinely has nothing better — passengers can still
        // override with a custom pickup from the map (see
        // MapPinConfirmScreen).
        pickupLat: pickupLat ?? ride.sourceLat,
        pickupLng: pickupLng ?? ride.sourceLng,
        pickupAddress: pickupAddress ?? ride.sourceAddress,
        // "Custom" here just means "not literally the ride's own
        // starting point" — it's what the driver's booking-request card
        // uses to decide whether to show a specific address or a plain
        // "Default pickup" label (BookingRequestsScreen.tsx). A search-
        // matched mid-route pickup (A1, not the ride's A) needs the real
        // address shown, same as a manually-dropped map pin would.
        isCustomPickup: pickupLat != null && (pickupLat !== ride.sourceLat || pickupLng !== ride.sourceLng),
        ...(dropLat != null ? { dropLat, dropLng, dropAddress, isCustomDrop: true } : {}),
      });
      Analytics.bookingCreated(rideId, seats);
      showAlert(t("booking.requestSent"), t("booking.driverHas20Min"));
      // Was navigating to Home, which meant the passenger had to find
      // their way back to "My requests" themselves to see the request
      // they just sent — land them right on it instead.
      navigation.navigate("MyRequests");
    } catch (err: any) {
      showAlert(t("booking.couldntBook"), err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // "bottom" deliberately left off SafeAreaView's edges below — the
  // sticky footer applies the bottom inset itself (see insets.bottom in
  // its own padding), since SafeAreaView would otherwise add it as
  // blank space below the footer instead of as room above the system
  // bar for the footer's own content. The loading/error states have
  // nothing bottom-anchored to protect, so they don't need it either.
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <BackHeader title={t("booking.confirmTitle")} onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error || !ride ? (
        <ErrorState message={t("booking.couldntLoadRide")} onRetry={load} />
      ) : (
        // Was a plain, non-scrolling View — with a variable-length route
        // stops list above it, the "Request booking" button could end up
        // pushed past the bottom of the screen entirely on a shorter
        // device (or a shrunk web viewport) with no way to scroll down to
        // reach it, reading as "the button is overlapping/hidden behind
        // the bottom of the screen" rather than what was actually
        // happening (it was rendered off-screen, not merely obscured).
        <>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* Hero — the one thing every screen like this leads with
              (Zomato's restaurant header, Ola's route summary): where
              you're going and when, before any of the finer detail. */}
          <View style={styles.heroCard}>
            <View style={styles.routeRow}>
              <Ionicons name="navigate-outline" size={14} color={colors.textMuted} />
              <Text style={styles.route}>{t("common.routeTo", { source: ride.sourceAddress, dest: ride.destAddress })}</Text>
            </View>
            {ride.driver?.name && (
              <Pressable
                style={styles.driverRow}
                onPress={() => ride.driver?.id && navigation.navigate("PublicProfile", { userId: ride.driver.id })}
              >
                <Avatar uri={ride.driver.photoViewUrl} name={ride.driver.name} size={32} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                    <Text style={styles.driverName}>{ride.driver.name}</Text>
                    {ride.driver.ratingAvg != null && (
                      <View style={styles.driverRatingRow}>
                        <Ionicons name="star" size={10} color={colors.marigold} />
                        <Text style={styles.driverName}>{ride.driver.ratingAvg.toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
                  {/* RC and license shown as two distinct badges — a
                      driver can be one without the other (verified once
                      covers every vehicle's license; each vehicle's RC
                      is its own separate check), so one merged pill
                      would hide exactly the distinction that matters. */}
                  <View style={styles.badgeRow}>
                    <VerifiedBadge
                      verified={!!ride.licenseVerified}
                      size="sm"
                      label={ride.licenseVerified ? t("badge.licenseVerified") : t("badge.licenseUnverified")}
                    />
                    <VerifiedBadge
                      verified={!!ride.rcVerified}
                      size="sm"
                      label={ride.rcVerified ? t("badge.rcVerified") : t("badge.rcUnverified")}
                    />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </Pressable>
            )}
            {ride.preferences && (
              <View style={styles.preferencesRow}>
                <RidePreferences preferences={ride.preferences} />
              </View>
            )}
          </View>

          <View style={styles.timelineCard}>
            <View style={styles.miniMapWrap}>
              <RouteMiniMap
                sourceLat={ride.sourceLat}
                sourceLng={ride.sourceLng}
                destLat={ride.destLat}
                destLng={ride.destLng}
                routePolyline={ride.routePolyline}
                height={170}
              />
            </View>
            {ride.routeStops && ride.routeStops.length > 0 ? (
              // The full step-by-step route (like a train app's stop
              // list) — only available once a route's been computed for
              // this ride (see lib/directions.js on the backend).
              <RouteStopsList stops={ride.routeStops} departAt={ride.travelDate} />
            ) : (
              <RouteTimeline
                departAt={ride.travelDate}
                arriveAt={ride.estimatedArrivalAt}
                durationMinutes={ride.estimatedDurationMinutes}
                sourceAddress={ride.sourceAddress}
                destAddress={ride.destAddress}
              />
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.row}>
              <View style={styles.labelRow}>
                <Ionicons name="people-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.label}>{t("searchOptions.seats")}</Text>
              </View>
              {full ? (
                <Text style={[styles.value, { color: colors.danger }]}>{t("search.full")}</Text>
              ) : (
                <View style={styles.stepper}>
                  <Pressable
                    style={[styles.stepperButton, seats <= 1 && styles.stepperButtonDisabled]}
                    disabled={seats <= 1}
                    onPress={() => adjustSeats(-1)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t("booking.decreaseSeats")}
                  >
                    <Ionicons name="remove" size={16} color={colors.textPrimary} />
                  </Pressable>
                  <Text style={styles.value}>{seats}</Text>
                  <Pressable
                    style={[
                      styles.stepperButton,
                      seats >= Math.min(ride.seatsAvailable, 8) && styles.stepperButtonDisabled,
                    ]}
                    disabled={seats >= Math.min(ride.seatsAvailable, 8)}
                    onPress={() => adjustSeats(1)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t("booking.increaseSeats")}
                  >
                    <Ionicons name="add" size={16} color={colors.textPrimary} />
                  </Pressable>
                </View>
              )}
            </View>
            <Text style={styles.availabilityHint}>
              {full ? t("booking.noSeatsLeft") : t("booking.seatsAvailable", { count: ride.seatsAvailable })}
            </Text>
          </View>

          {/* Receipt-style breakdown — per-seat rate × count, a dashed
              rule, then the bold total, same visual grammar as a food
              app's bill summary rather than a single flat "Fare" row. */}
          <View style={styles.billCard}>
            <Text style={styles.billTitle}>{t("booking.billTitle")}</Text>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>{t("booking.farePerSeat", { amount: formatInr(ride.segmentPricePerSeat ?? ride.pricePerSeat) })}</Text>
              <Text style={styles.billValue}>× {seats}</Text>
            </View>
            <View style={styles.billDashedRule} />
            <View style={styles.billRow}>
              <Text style={styles.billTotalLabel}>{t("booking.toPayDriver")}</Text>
              <Text style={styles.billTotalValue}>Rs {formatInr(fare)}</Text>
            </View>
            <View style={styles.notice}>
              <Ionicons name="information-circle-outline" size={16} color={colors.accentText} />
              <Text style={styles.noticeText}>{t("booking.feeNotice")}</Text>
            </View>
          </View>

          {/* What other passengers have said — moved to the bottom,
              below the actual booking decision (route/seats/price),
              since it's supporting context for that decision rather
              than the first thing to lead with. */}
          {driverReviews.length > 0 && (
            <View style={styles.reviewsWrap}>
              <View style={styles.reviewsHeaderRow}>
                <Text style={styles.reviewsTitle}>{t("booking.aboutThisDriver")}</Text>
                {driverReviews.length > 2 && ride.driver?.id && (
                  <Pressable onPress={() => navigation.navigate("PublicProfile", { userId: ride.driver!.id })}>
                    <Text style={styles.reviewsSeeAll}>{t("booking.seeAllReviews")}</Text>
                  </Pressable>
                )}
              </View>
              {driverReviews.slice(0, 2).map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <Text style={styles.reviewStars}>{"★".repeat(review.rating)}</Text>
                  {review.comment ? <Text style={styles.reviewComment} numberOfLines={2}>{review.comment}</Text> : null}
                  <Text style={styles.reviewFrom}>{review.fromUser?.name || t("publicProfile.riderFallback")}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Sticky bottom bar — total + CTA stay reachable regardless of
            scroll position, same convention a checkout screen like this
            usually uses instead of burying the action at the end of a
            long scroll. */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View>
            <Text style={styles.footerLabel}>{t("booking.toPayDriver")}</Text>
            <Text style={styles.footerAmount}>Rs {formatInr(fare)}</Text>
          </View>
          <Pressable
            style={[styles.button, (submitting || full) && { opacity: 0.6 }]}
            onPress={handleRequestBooking}
            disabled={submitting || full}
          >
            {!full && !submitting && <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" />}
            <Text style={styles.buttonText}>
              {full ? t("booking.rideIsFull") : submitting ? t("booking.sendingRequest") : t("booking.requestBooking")}
            </Text>
          </Pressable>
        </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  heroCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  routeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  route: { ...typography.title, fontSize: 15 },
  driverRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  driverName: { ...typography.caption, color: colors.textSecondary, fontWeight: "700", fontFamily: FONT.bold },
  driverRatingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: spacing.xs },
  preferencesRow: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  reviewsWrap: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  reviewsHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reviewsTitle: { ...typography.caption, color: colors.textSecondary, fontWeight: "700", fontFamily: FONT.bold },
  reviewsSeeAll: { ...typography.small, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  reviewCard: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.xs },
  reviewStars: { color: colors.marigold, fontSize: 12 },
  reviewComment: { ...typography.caption, marginTop: 3, color: colors.textPrimary },
  reviewFrom: { ...typography.small, color: colors.textMuted, marginTop: 3 },
  timelineCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  sectionCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  miniMapWrap: { marginBottom: spacing.sm },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { ...typography.caption, color: colors.textSecondary },
  value: { ...typography.title, fontVariant: ["tabular-nums"] },
  availabilityHint: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonDisabled: { opacity: 0.4 },
  // Receipt-style bill card — a dashed rule ahead of the bold total is
  // the same visual grammar a food-delivery checkout screen uses to
  // separate "line items" from "what you actually owe."
  billCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  billTitle: { ...typography.caption, color: colors.textSecondary, fontWeight: "700", fontFamily: FONT.bold, marginBottom: spacing.sm },
  billRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 },
  billLabel: { ...typography.caption, color: colors.textSecondary },
  billValue: { ...typography.caption, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
  billDashedRule: { borderStyle: "dashed", borderBottomWidth: 1, borderBottomColor: colors.border, marginVertical: spacing.sm },
  billTotalLabel: { ...typography.body, fontWeight: "700", fontFamily: FONT.bold },
  billTotalValue: { ...typography.title, fontVariant: ["tabular-nums"] },
  notice: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.accentBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  noticeText: { ...typography.small, color: colors.accentText, flex: 1 },
  footer: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
  },
  footerLabel: { ...typography.small, color: colors.textMuted },
  footerAmount: { ...typography.titleCompact, fontVariant: ["tabular-nums"] },
  button: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonText: { ...typography.title, color: "#FFFFFF" },
});
