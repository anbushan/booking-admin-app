import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { primeLocationIfNeeded } from "../lib/locationPriming";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { dialProxyNumber } from "../lib/callHelper";
import { useScreenView } from "../lib/useScreenView";
import Avatar from "../components/Avatar";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { TripPickupMap } from "../components/TripPickupMap";
import { shareTrip } from "../lib/shareTrip";
import { useTranslation } from "../lib/i18n/I18nContext";

const OTP_LENGTH = 4;

export default function TripOtpScreen({ route, navigation }: any) {
  useScreenView("TripOtpScreen");
  const { t } = useTranslation();
  const { bookingId } = route.params;
  const [otp, setOtp] = useState<string | null>(null);
  const [driverName, setDriverName] = useState(t("tripOtp.driverFallback"));
  const [driverPhoto, setDriverPhoto] = useState<string | null>(null);
  const [driverRating, setDriverRating] = useState<number | null>(null);
  const [driverVerified, setDriverVerified] = useState(false);
  const [vehicle, setVehicle] = useState<{ regNumber: string; make: string; model: string; color: string | null } | null>(null);
  const [routeLabel, setRouteLabel] = useState<string | null>(null);
  const [routeAddresses, setRouteAddresses] = useState<{ source: string; dest: string } | null>(null);
  const [calling, setCalling] = useState(false);
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number } | null>(null);
  const navigatedAway = useRef(false);
  const { showError } = useToast();

  useEffect(() => {
    // The OTP is generated server-side when the driver taps "Start trip"
    // and delivered to this screen — never sent by SMS, so it isn't
    // dependent on carrier delivery at a possibly low-signal pickup point.
    api.getTripOtp(bookingId).then((res) => setOtp(res.otp));
    api
      .getBookingDetail(bookingId)
      .then((booking) => {
        if (booking.ride?.driver?.name) setDriverName(booking.ride.driver.name);
        if (booking.ride?.driver?.photoViewUrl) setDriverPhoto(booking.ride.driver.photoViewUrl);
        if (booking.ride?.driver?.ratingAvg != null) setDriverRating(booking.ride.driver.ratingAvg);
        setDriverVerified(!!booking.ride?.driverVerified);
        if (booking.ride?.vehicle) setVehicle(booking.ride.vehicle);
        if (booking.ride) {
          setRouteLabel(t("common.routeTo", { source: booking.ride.sourceAddress, dest: booking.ride.destAddress }));
          setRouteAddresses({ source: booking.ride.sourceAddress, dest: booking.ride.destAddress });
        }
        if (booking.pickupLat != null && booking.pickupLng != null) {
          setPickupCoords({ lat: booking.pickupLat, lng: booking.pickupLng });
        }
      })
      .catch(() => {});
  }, [bookingId]);

  // No more manual "Track this trip" button — the moment the driver
  // actually verifies the code on their end (booking flips to
  // IN_PROGRESS), this screen jumps straight to live tracking on its
  // own. Polling rather than waiting for a push notification keeps this
  // working even if notification permission was denied.
  useEffect(() => {
    const poll = setInterval(async () => {
      if (navigatedAway.current) return;
      try {
        const track = await api.trackTrip(bookingId);
        if (track.status === "IN_PROGRESS") {
          navigatedAway.current = true;
          clearInterval(poll);
          primeLocationIfNeeded(navigation, "LiveTracking", { bookingId, role: "PASSENGER" });
          return;
        }
        // See TripPickupMap — trackTrip already returned lat/lng the
        // whole time, this is just the first thing that actually reads
        // them instead of only checking `status`. Driver-side comes from
        // StartTripScreen's own ping loop, which now runs during exactly
        // this pre-verification window (see trips.routes.js's
        // /:bookingId/location for why CONFIRMED bookings are included).
        if (track.lat != null && track.lng != null) {
          setDriverCoords({ lat: track.lat, lng: track.lng });
        }
      } catch {
        // swallow — a missed poll just tries again in 3s
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [bookingId]);

  async function handleCall() {
    setCalling(true);
    try {
      const { proxyNumber } = await api.initiateCall(bookingId, "DRIVER");
      await dialProxyNumber(proxyNumber);
    } catch (err: any) {
      showError(err.message || t("common.couldntStartCall"));
    } finally {
      setCalling(false);
    }
  }

  async function handleShareTrip() {
    if (!routeAddresses) return;
    try {
      await shareTrip({
        t,
        otherPartyName: driverName,
        vehicleLabel: vehicle ? `${vehicle.regNumber} · ${vehicle.make} ${vehicle.model}` : null,
        sourceAddress: routeAddresses.source,
        destAddress: routeAddresses.dest,
        lat: driverCoords?.lat ?? pickupCoords?.lat ?? null,
        lng: driverCoords?.lng ?? pickupCoords?.lng ?? null,
      });
    } catch {
      // Share sheet dismissed/cancelled — nothing to surface as an error.
    }
  }

  const digits = (otp || "").padEnd(OTP_LENGTH, " ").slice(0, OTP_LENGTH).split("");

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("tripOtp.driverHasArrived")} onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <View style={styles.codeCard}>
          <Text style={styles.instruction}>{t("trip.shareCode", { driverName })}</Text>
          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <View key={i} style={styles.otpBox}>
                <Text style={styles.otpDigit}>{otp ? d : ""}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* The actual thing a passenger checks before getting in — the
            OTP alone doesn't help them tell this car apart from any
            other one idling nearby. Styled like a real plate (letter
            spacing, bordered) so it reads instantly, not just as
            another line of text. */}
        {vehicle && (
          <View style={styles.plateCard}>
            <Ionicons name="car-sport" size={15} color={colors.textSecondary} />
            <View>
              <Text style={styles.plateNumber}>{vehicle.regNumber}</Text>
              <Text style={styles.plateModel}>
                {vehicle.color ? `${vehicle.color} ` : ""}{vehicle.make} {vehicle.model}
              </Text>
            </View>
          </View>
        )}

        {/* Rapido/Uber/Ola-style visual reassurance while waiting — see
            TripPickupMap for why the driver marker only shows up once
            StartTripScreen's own ping loop has actually reported a
            position (there's no data to plot before that). */}
        <TripPickupMap
          driverLat={driverCoords?.lat ?? null}
          driverLng={driverCoords?.lng ?? null}
          pickupLat={pickupCoords?.lat ?? null}
          pickupLng={pickupCoords?.lng ?? null}
        />

        <View style={styles.infoRow}>
          <Ionicons name="shield-checkmark-outline" size={15} color={colors.textMuted} />
          <Text style={styles.hint}>{t("tripOtp.confirmsRide")}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
          <Text style={styles.altHint}>{t("tripOtp.altHint", { bookingId })}</Text>
        </View>
        {routeLabel && (
          <View style={styles.infoRow}>
            <Ionicons name="navigate-outline" size={15} color={colors.textMuted} />
            <Text style={styles.routeLabel}>{routeLabel}</Text>
          </View>
        )}
      </View>

      <View style={styles.driverBar}>
        <Avatar uri={driverPhoto} name={driverName} size={44} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={styles.driverName}>{driverName}</Text>
            <VerifiedBadge verified={driverVerified} size="sm" />
          </View>
          {driverRating != null && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={11} color={colors.warning} />
              <Text style={styles.driverMeta}>{driverRating.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <Pressable style={styles.iconButton} onPress={handleCall} disabled={calling} hitSlop={4}>
          <Ionicons name="call-outline" size={17} color={colors.accentText} />
        </Pressable>
        <Pressable
          style={styles.iconButton}
          onPress={() => navigation.navigate("ChatDetail", {
            bookingId,
            calleeRole: "DRIVER",
            // Already in state (rendered right above) — see
            // ChatDetailScreen's header comment for why this kills the
            // flicker on this entry point too.
            otherName: driverName,
            otherPhoto: driverPhoto,
          })}
          hitSlop={4}
        >
          <Ionicons name="chatbubble-outline" size={17} color={colors.accentText} />
        </Pressable>
        {Platform.OS !== "web" && (
          <Pressable
            style={styles.iconButton}
            onPress={handleShareTrip}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t("trip.shareTrip")}
          >
            <Ionicons name="share-social-outline" size={17} color={colors.accentText} />
          </Pressable>
        )}
      </View>

      <View style={styles.waitingRow}>
        <Ionicons name="time-outline" size={15} color={colors.textMuted} />
        <Text style={styles.waitingText}>{t("tripOtp.willBeTaken")}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  codeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
  },
  instruction: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: "center" },
  otpRow: { flexDirection: "row", gap: spacing.sm },
  otpBox: {
    width: 56,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  otpDigit: { fontSize: 28, fontWeight: "700", fontFamily: FONT.bold, color: colors.accentText },
  plateCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  plateNumber: { fontSize: 16, fontWeight: "700", fontFamily: FONT.bold, color: colors.textPrimary, letterSpacing: 1.5 },
  plateModel: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: spacing.md, maxWidth: 300 },
  hint: { ...typography.small, color: colors.textMuted, flex: 1 },
  altHint: { ...typography.small, color: colors.textMuted, flex: 1 },
  routeLabel: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  driverBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  driverName: { ...typography.body, fontWeight: "700", fontFamily: FONT.bold },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  driverMeta: { ...typography.small, color: colors.textMuted },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  waitingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, margin: spacing.lg, marginTop: spacing.sm },
  waitingText: { ...typography.small, color: colors.textMuted, textAlign: "center", flexShrink: 1 },
});
