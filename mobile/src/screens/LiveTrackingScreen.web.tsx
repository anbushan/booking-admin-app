import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDeviceCoords } from "../lib/deviceLocation";
import { dialProxyNumber } from "../lib/callHelper";
import { useScreenView } from "../lib/useScreenView";
import Avatar from "../components/Avatar";
import { useTranslation } from "../lib/i18n/I18nContext";

// Web build of LiveTrackingScreen — react-native-maps is a native-only
// module (it imports RN's codegen internals directly), so importing it
// breaks the entire web bundle, not just this screen. Metro/Expo picks
// this .web.tsx file automatically when bundling for web and falls back
// to a plain coordinates readout instead of a real map. Everything else
// (polling, SOS hold-to-confirm, trip completion) is unchanged from the
// native version.

const STALE_THRESHOLD_MS = 90 * 1000;
const SOS_HOLD_MS = 3000;
const LOCATION_REPORT_INTERVAL_MS = 10 * 1000;
const TRIP_PHASE_KEYS = ["journey.tripStarted", "status.onTheWay", "liveTracking.arriving"];


export default function LiveTrackingScreen({ route, navigation }: any) {
  useScreenView("LiveTrackingScreen");
  const { t } = useTranslation();
  const { bookingId, role } = route.params; // role: "DRIVER" | "PASSENGER"
  const [lastLocationAt, setLastLocationAt] = useState<string | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [driverPhoto, setDriverPhoto] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [calling, setCalling] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigatedAway = useRef(false);
  const { showError } = useToast();

  useEffect(() => {
    api.getBookingDetail(bookingId).then((booking) => {
      if (booking.ride?.driver?.photoViewUrl) setDriverPhoto(booking.ride.driver.photoViewUrl);
    }).catch(() => {});
  }, [bookingId]);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const track = await api.trackTrip(bookingId);
        setLastLocationAt(track.lastLocationAt);
        if (track.lat && track.lng) setPosition({ lat: track.lat, lng: track.lng });
        if (track.driverName) setDriverName(track.driverName);

        // The platform fee is already paid up by the time either side is
        // on this screen (tracking only starts once IN_PROGRESS), so
        // there's no more in-app payment step to navigate to. Instead,
        // react to the trip ending — either normally (COMPLETED, with
        // the cash/UPI amount now due) or abnormally (STOPPED, closed by
        // either side mid-ride).
        if (!navigatedAway.current && track.status === "COMPLETED") {
          navigatedAway.current = true;
          if (role === "PASSENGER") {
            showAlert(t("liveTracking.tripCompletedTitle"), t("liveTracking.payDirectly", { amount: track.amount ?? 0 }));
            // Straight into rating the driver now, rather than relying on
            // the passenger to dig up this COMPLETED booking later —
            // "My bookings" is active-trip-only and won't list it once
            // this screen navigates away.
            navigation.replace("RateReview", {
              bookingId,
              toUserId: track.driverId,
              toUserName: track.driverName,
            });
          } else {
            navigation.replace("History", { role });
          }
        } else if (!navigatedAway.current && track.status === "STOPPED") {
          navigatedAway.current = true;
          showAlert(t("liveTracking.rideClosedTitle"), t("liveTracking.rideClosedBody"));
          navigation.replace("History", { role });
        }
      } catch {
        // swallow — the stale-state UI below already communicates the gap
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [bookingId, role]);

  // The driver's own device is the only source of truth for where the
  // driver actually is — nothing was ever calling api.pingLocation
  // before this, so lastLat/lastLng on the booking (and therefore this
  // whole screen, for both sides) never had real data to show.
  useEffect(() => {
    if (role !== "DRIVER") return;
    const report = setInterval(async () => {
      try {
        const { lat, lng } = await getDeviceCoords();
        setPosition({ lat, lng });
        await api.pingLocation(bookingId, lat, lng);
      } catch {
        // Best-effort — a missed ping shouldn't interrupt the trip; the
        // passenger's stale-state UI already communicates the gap.
      }
    }, LOCATION_REPORT_INTERVAL_MS);
    return () => clearInterval(report);
  }, [bookingId, role]);

  const isStale =
    !lastLocationAt || Date.now() - new Date(lastLocationAt).getTime() > STALE_THRESHOLD_MS;
  const phaseIndex = isStale ? 0 : 1;

  function startHold() {
    setHolding(true);
    holdTimer.current = setTimeout(async () => {
      setHolding(false);
      try {
        const loc = position || { lat: 12.9352, lng: 77.6146 };
        await api.triggerSos(bookingId, loc);
        Analytics.sosTriggered(bookingId);
        showAlert(t("liveTracking.helpOnWayTitle"), t("liveTracking.helpOnWayBody"));
      } catch (err: any) {
        showAlert(t("liveTracking.couldntSendSos"), err.message);
      }
    }, SOS_HOLD_MS);
  }

  function cancelHold() {
    setHolding(false);
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }

  function handleCompleteTrip() {
    navigation.navigate("CompleteTripConfirmation", { bookingId });
  }

  async function handleCall() {
    setCalling(true);
    try {
      const { proxyNumber } = await api.initiateCall(bookingId, role === "DRIVER" ? "PASSENGER" : "DRIVER");
      await dialProxyNumber(proxyNumber);
    } catch (err: any) {
      showError(err.message || t("common.couldntStartCall"));
    } finally {
      setCalling(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.mapArea}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map-outline" size={26} color={colors.accentText} />
          <Text style={styles.mapPlaceholderText}>
            {position
              ? t("liveTracking.lastKnownPosition", { coords: `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` })
              : t("liveTracking.waitingForLocation")}
          </Text>
          <Text style={styles.mapPlaceholderHint}>{t("liveTracking.mapNotAvailable")}</Text>
        </View>

        <Pressable style={styles.floatingBack} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.etaBadge}>
          <Ionicons name={isStale ? "sync-outline" : "time"} size={13} color={colors.accentText} />
          <Text style={styles.etaText}>{isStale ? t("trip.reconnecting") : t("liveTracking.etaMin", { min: 18 })}</Text>
        </View>
      </View>

      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />

        <Text style={styles.statusTitle}>{t("liveTracking.tripInProgress")}</Text>

        <View style={styles.phaseRow}>
          {TRIP_PHASE_KEYS.map((key, i) => (
            <React.Fragment key={key}>
              <View style={styles.phaseStep}>
                <View style={[styles.phaseDot, i <= phaseIndex && styles.phaseDotActive]}>
                  {i < phaseIndex ? <Ionicons name="checkmark" size={10} color="#FFFFFF" /> : null}
                </View>
                <Text style={[styles.phaseLabel, i <= phaseIndex && styles.phaseLabelActive]}>{t(key)}</Text>
              </View>
              {i < TRIP_PHASE_KEYS.length - 1 && (
                <View style={[styles.phaseConnector, i < phaseIndex && styles.phaseConnectorActive]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {role !== "DRIVER" && (
          <View style={styles.driverRow}>
            <Avatar uri={driverPhoto} name={driverName || "D"} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{driverName || t("liveTracking.driverFallback")}</Text>
              <Text style={styles.driverSub}>{isStale ? t("liveTracking.lastKnownAMomentAgo") : t("liveTracking.enRouteToYou")}</Text>
            </View>
            <Pressable style={styles.callButton} onPress={handleCall} disabled={calling}>
              <Ionicons name={calling ? "call" : "call-outline"} size={17} color={colors.success} />
            </Pressable>
          </View>
        )}

        <View style={styles.actions}>
          {role === "DRIVER" && (
            <Pressable style={styles.completeButton} onPress={handleCompleteTrip}>
              <Ionicons name="flag-outline" size={17} color="#FFFFFF" />
              <Text style={styles.completeButtonText}>{t("liveTracking.completeTrip")}</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.sosButton, holding && styles.sosButtonHolding]}
            onPressIn={startHold}
            onPressOut={cancelHold}
          >
            <Ionicons name="alert-circle-outline" size={16} color={holding ? "#FFFFFF" : colors.danger} />
            <Text style={[styles.sosText, holding && { color: "#FFFFFF" }]}>
              {holding ? t("liveTracking.keepHolding") : t("trip.sosHold")}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  mapArea: { height: 280, backgroundColor: colors.accentBg, justifyContent: "flex-start" },
  mapPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.xs },
  mapPlaceholderText: { ...typography.body, color: colors.accentText, textAlign: "center" },
  mapPlaceholderHint: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
  floatingBack: {
    position: "absolute", top: spacing.md, left: spacing.md,
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  etaBadge: {
    position: "absolute", top: spacing.md, right: spacing.md,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  etaText: { ...typography.caption, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    marginTop: -radius.lg,
    padding: spacing.lg,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md },
  statusTitle: { ...typography.title, fontSize: 17 },
  phaseRow: { flexDirection: "row", alignItems: "flex-start", marginTop: spacing.lg },
  phaseStep: { alignItems: "center", width: 76 },
  phaseDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" },
  phaseDotActive: { backgroundColor: colors.accent },
  phaseLabel: { ...typography.small, color: colors.textMuted, marginTop: 4, textAlign: "center" },
  phaseLabelActive: { color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  phaseConnector: { flex: 1, height: 2, backgroundColor: colors.border, marginTop: 9 },
  phaseConnectorActive: { backgroundColor: colors.accent },
  driverRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xl,
    paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border,
  },
  driverName: { ...typography.title, fontSize: 14 },
  driverSub: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  callButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center" },
  actions: { gap: spacing.md, marginTop: spacing.xl },
  completeButton: {
    flexDirection: "row", gap: spacing.xs,
    backgroundColor: colors.textPrimary,
    height: 48,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  completeButtonText: { ...typography.title, color: "#FFFFFF" },
  sosButton: {
    flexDirection: "row", gap: 6,
    backgroundColor: colors.dangerBg,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  sosButtonHolding: { backgroundColor: colors.danger },
  sosText: { ...typography.title, color: colors.danger, fontSize: 13 },
});
