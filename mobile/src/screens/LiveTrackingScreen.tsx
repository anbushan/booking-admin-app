import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Pressable } from "../components/Pressable";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import MapView, { Marker, MarkerAnimated, AnimatedRegion, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";
import { decodePolyline, haversineKm, bearingDeg, LatLng } from "../lib/mapGeo";
import { dialProxyNumber } from "../lib/callHelper";
import { useScreenView } from "../lib/useScreenView";
import { CarLoader } from "../components/CarLoader";
import Avatar from "../components/Avatar";
import { useTranslation } from "../lib/i18n/I18nContext";

const STALE_THRESHOLD_MS = 90 * 1000;
const SOS_HOLD_MS = 3000;
const LOCATION_REPORT_INTERVAL_MS = 10 * 1000;
const MANIFEST_POLL_INTERVAL_MS = 8 * 1000;
const AVG_SPEED_KMH = 25; // rough city-driving assumption, just for an ETA estimate
const CAR_MOVE_DURATION_MS = 900; // matches the poll cadence closely enough to read as continuous motion

type ManifestStop = {
  id: string;
  action: "AWAITING_START" | "AWAITING_OTP" | "IN_PROGRESS" | "COMPLETED";
  seatsBooked: number;
  pickupAddress: string;
  dropAddress: string;
  passenger: { id: string; name: string; ratingAvg?: number | null; photoViewUrl?: string | null };
};

// The three phases of a live trip, shown as a compact progress line at
// the top of the info sheet — the same "where is this now" idea as the
// booking step tracker, just condensed for a screen that's already
// mostly map. journey.tripStarted/status.onTheWay are reused from
// elsewhere in the app since the wording matches exactly.
const TRIP_PHASE_KEYS = ["journey.tripStarted", "status.onTheWay", "liveTracking.arriving"];

// Raw coordinates only — unlike lib/api.ts's getCurrentLocation (used
// for pickup-point selection), this deliberately skips the
// reverse-geocode-to-an-address step, which would otherwise fire an
// extra Google Geocoding call every single ping.
async function getDeviceCoords() {
  let { status } = await Location.getForegroundPermissionsAsync();
  if (status !== "granted") {
    ({ status } = await Location.requestForegroundPermissionsAsync());
  }
  if (status !== "granted") {
    throw new Error("Location permission denied.");
  }
  const position = await Location.getCurrentPositionAsync({});
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

// Index into `coords` closest to `point` — a cheap brute-force nearest
// point (route polylines here are a few dozen to a couple hundred
// vertices, not thousands), used to split the route into a "done" and
// "still ahead" segment so the line on the map actually reflects
// progress, the way a turn-by-turn nav app dims the road already driven.
function closestRouteIndex(coords: LatLng[], point: { lat: number; lng: number }) {
  let best = 0;
  let bestDist = Infinity;
  coords.forEach((c, i) => {
    const d = haversineKm({ lat: c.latitude, lng: c.longitude }, point);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

export default function LiveTrackingScreen({ route, navigation }: any) {
  useScreenView("LiveTrackingScreen");
  const { t } = useTranslation();
  const { bookingId, role } = route.params; // role: "DRIVER" | "PASSENGER"
  const [lastLocationAt, setLastLocationAt] = useState<string | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [driverPhoto, setDriverPhoto] = useState<string | null>(null);
  const [ride, setRide] = useState<{
    id: string;
    sourceLat: number; sourceLng: number; destLat: number; destLng: number;
    sourceAddress: string; destAddress: string; routePolyline: string | null;
  } | null>(null);
  // Every passenger currently relevant to this ride, not just this
  // screen's own bookingId — a ride only ever has one at a time under
  // the old flat-seat model, but segment-aware booking (see backend
  // lib/segments.js) means several can be confirmed/in-progress at
  // once, boarding and alighting at different points along the same
  // drive. Driver-only; a passenger has no reason to see anyone else's
  // booking. Degenerates to a single row for the common one-passenger
  // ride, so nothing about that case reads any differently than before.
  const [manifest, setManifest] = useState<ManifestStop[] | null>(null);
  const [carHeading, setCarHeading] = useState(0);
  const [holding, setHolding] = useState(false);
  const [calling, setCalling] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigatedAway = useRef(false);
  const mapRef = useRef<MapView>(null);
  const fittedRef = useRef(false);
  const prevPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const animatedCoordinateRef = useRef<AnimatedRegion | null>(null);
  const [carVisible, setCarVisible] = useState(false);
  const { showError } = useToast();

  // The ride's route (source, destination, and the polyline captured
  // when the driver picked this route in OfferRide) only needs fetching
  // once — it never changes mid-trip, unlike position, which polls.
  useEffect(() => {
    api.getBookingDetail(bookingId).then((booking) => {
      if (booking.ride?.driver?.photoViewUrl) setDriverPhoto(booking.ride.driver.photoViewUrl);
      if (booking.ride) {
        setRide({
          id: booking.ride.id,
          sourceLat: booking.ride.sourceLat,
          sourceLng: booking.ride.sourceLng,
          destLat: booking.ride.destLat,
          destLng: booking.ride.destLng,
          sourceAddress: booking.ride.sourceAddress,
          destAddress: booking.ride.destAddress,
          routePolyline: booking.ride.routePolyline ?? null,
        });
      }
    }).catch(() => {});
  }, [bookingId]);

  // Driver-only: who else is on this ride right now and what each of
  // them needs next (see backend GET /api/trips/ride/:rideId/manifest).
  // Polls independently of the position-tracking poll above — this can
  // change from actions taken on a completely different screen instance
  // (e.g. verifying a different passenger's OTP from StartTripScreen),
  // not just from time passing.
  useEffect(() => {
    if (role !== "DRIVER" || !ride?.id) return;
    let cancelled = false;
    function load() {
      api.getTripManifest(ride!.id).then((data) => {
        if (!cancelled) setManifest(data.stops);
      }).catch(() => {});
    }
    load();
    const poll = setInterval(load, MANIFEST_POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(poll); };
  }, [role, ride?.id]);

  // Decoded route line. Falls back to a straight line between source and
  // destination for older rides published before route selection stored
  // a polyline — still shows start/end correctly, just without the
  // road-shaped path.
  const routeCoords = useMemo<LatLng[]>(() => {
    if (!ride) return [];
    if (ride.routePolyline) {
      try {
        const decoded = decodePolyline(ride.routePolyline);
        if (decoded.length > 1) return decoded;
      } catch {
        // fall through to the straight-line fallback below
      }
    }
    return [
      { latitude: ride.sourceLat, longitude: ride.sourceLng },
      { latitude: ride.destLat, longitude: ride.destLng },
    ];
  }, [ride]);

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
        // either side mid-ride). Guarded so this only fires once even
        // though polling continues.
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

  // Frame the whole route (start → end) once it's known — this used to
  // be entirely missing, so the map only ever showed whatever tiny area
  // happened to be under the last raw position ping.
  useEffect(() => {
    if (fittedRef.current || !mapRef.current || routeCoords.length < 2) return;
    fittedRef.current = true;
    mapRef.current.fitToCoordinates(routeCoords, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  }, [routeCoords]);

  // Every new position ping: smoothly glide the car marker to it (rather
  // than snapping, like a delivery app's live courier marker), point it
  // in the direction of travel, and pan the camera to follow along.
  useEffect(() => {
    if (!position) return;
    if (!animatedCoordinateRef.current) {
      animatedCoordinateRef.current = new AnimatedRegion({
        latitude: position.lat,
        longitude: position.lng,
        latitudeDelta: 0,
        longitudeDelta: 0,
      });
      setCarVisible(true);
    } else {
      const prev = prevPositionRef.current;
      if (prev && (prev.lat !== position.lat || prev.lng !== position.lng)) {
        setCarHeading(bearingDeg(prev, position));
      }
      animatedCoordinateRef.current
        .timing({ latitude: position.lat, longitude: position.lng, duration: CAR_MOVE_DURATION_MS, useNativeDriver: false } as any)
        .start();
      // Only start following once the initial route overview has had a
      // moment to be seen — an abrupt zoom-to-marker right on load would
      // undercut the "here's the whole route" framing fitToCoordinates
      // just did.
      if (fittedRef.current) {
        mapRef.current?.animateCamera({ center: { latitude: position.lat, longitude: position.lng } }, { duration: CAR_MOVE_DURATION_MS });
      }
    }
    prevPositionRef.current = position;
  }, [position]);

  const isStale =
    !lastLocationAt || Date.now() - new Date(lastLocationAt).getTime() > STALE_THRESHOLD_MS;

  const remainingKm =
    position && ride ? haversineKm(position, { lat: ride.destLat, lng: ride.destLng }) : null;
  const etaMinutes = remainingKm != null ? Math.max(1, Math.round((remainingKm / AVG_SPEED_KMH) * 60)) : null;
  // Real progress once we know both the route and where the car actually
  // is — "Arriving" lights up in the last ~500m instead of the tracker
  // being stuck on a placeholder "midway" state for the whole trip.
  const phaseIndex = isStale ? 0 : remainingKm != null && remainingKm < 0.5 ? 2 : 1;

  const progressIndex = useMemo(
    () => (position && routeCoords.length > 1 ? closestRouteIndex(routeCoords, position) : 0),
    [routeCoords, position]
  );
  const traveledCoords = routeCoords.slice(0, progressIndex + 1);
  const remainingCoords = routeCoords.slice(progressIndex);

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

  // Every manifest row's action routes through here — always by that
  // row's OWN bookingId, never assuming it's the same one this screen
  // instance opened with. Reuses the exact same per-booking screens the
  // single-passenger flow always has (StartTripScreen, Complete
  // TripConfirmationScreen); a ride with only one passenger behaves
  // identically to before, just via a named row instead of a bare button.
  function handleStopAction(stop: ManifestStop) {
    if (stop.action === "AWAITING_START" || stop.action === "AWAITING_OTP") {
      navigation.navigate("StartTrip", { bookingId: stop.id });
    } else if (stop.action === "IN_PROGRESS") {
      navigation.navigate("CompleteTripConfirmation", { bookingId: stop.id, rideId: ride?.id });
    }
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
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: ride?.sourceLat ?? position?.lat ?? 12.9352,
            longitude: ride?.sourceLng ?? position?.lng ?? 77.6146,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {/* Route ahead vs. already driven — two segments split at the
              point on the polyline closest to the current position, so
              the line itself shows progress, not just a static path. */}
          {remainingCoords.length > 1 && (
            <Polyline coordinates={remainingCoords} strokeColor={colors.accent} strokeWidth={4} />
          )}
          {traveledCoords.length > 1 && (
            <Polyline coordinates={traveledCoords} strokeColor={colors.border} strokeWidth={4} />
          )}

          {ride && (
            <Marker coordinate={{ latitude: ride.sourceLat, longitude: ride.sourceLng }} title="Pickup" description={ride.sourceAddress} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.startPin}>
                <View style={styles.startPinDot} />
              </View>
            </Marker>
          )}
          {ride && (
            <Marker coordinate={{ latitude: ride.destLat, longitude: ride.destLng }} title="Drop-off" description={ride.destAddress} anchor={{ x: 0.5, y: 1 }}>
              <View style={styles.endPin}>
                <Ionicons name="flag" size={14} color="#FFFFFF" />
              </View>
            </Marker>
          )}

          {carVisible && animatedCoordinateRef.current && (
            <MarkerAnimated coordinate={animatedCoordinateRef.current} anchor={{ x: 0.5, y: 0.5 }} title={role === "DRIVER" ? "You" : "Driver"} flat>
              <Animated.View style={[styles.carMarker, { transform: [{ rotate: `${carHeading}deg` }] }, isStale && { opacity: 0.5 }]}>
                <Ionicons name="car-sport" size={16} color="#FFFFFF" />
              </Animated.View>
            </MarkerAnimated>
          )}
        </MapView>

        <Pressable style={styles.floatingBack} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.etaBadge}>
          <Ionicons name={isStale ? "sync-outline" : "time"} size={13} color={colors.accentText} />
          <Text style={styles.etaText}>
            {isStale ? t("trip.reconnecting") : etaMinutes != null ? t("liveTracking.etaMin", { min: etaMinutes }) : t("liveTracking.calculating")}
          </Text>
        </View>
      </View>

      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />

        <Text style={styles.statusTitle}>{t("liveTracking.tripInProgress")}</Text>

        {/* Zomato-style condensed progress — three phases instead of the
            full multi-step booking tracker, since by this point the trip
            has already started; what's left to communicate is just
            where along the drive it is right now. */}
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
              <Text style={styles.driverSub}>{isStale ? t("liveTracking.lastKnownAMomentAgo") : t("liveTracking.enRouteToDestination")}</Text>
            </View>
            <Pressable style={styles.callButton} onPress={handleCall} disabled={calling}>
              <Ionicons name={calling ? "call" : "call-outline"} size={17} color={colors.success} />
            </Pressable>
          </View>
        )}

        {/* Every passenger on this ride, oldest-boarding-first, each with
            its own clearly-named action — replaces a single bare
            "Complete trip" button, which had no way to say WHICH
            passenger it meant the moment a ride could carry more than
            one at a time. A one-passenger ride still shows exactly one
            row here, so nothing about the common case looks any busier
            than the old single button did. */}
        {role === "DRIVER" && (
          <View style={styles.manifestWrap}>
            <Text style={styles.manifestTitle}>{t("liveTracking.passengersOnThisRide")}</Text>
            {manifest == null ? (
              <CarLoader size="sm" />
            ) : (
              manifest.map((stop) => (
                <View key={stop.id} style={styles.manifestRow}>
                  <Avatar uri={stop.passenger.photoViewUrl} name={stop.passenger.name} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.manifestName} numberOfLines={1}>{stop.passenger.name}</Text>
                    <Text style={styles.manifestSub} numberOfLines={1}>
                      {stop.action === "COMPLETED"
                        ? t("liveTracking.droppedOff")
                        : stop.action === "IN_PROGRESS"
                        ? t("liveTracking.onBoardTo", { place: stop.dropAddress })
                        : t("liveTracking.pickupAt", { place: stop.pickupAddress })}
                    </Text>
                  </View>
                  {stop.action === "COMPLETED" ? (
                    <View style={styles.manifestDoneBadge}>
                      <Ionicons name="checkmark" size={14} color={colors.success} />
                    </View>
                  ) : (
                    <Pressable style={styles.manifestActionButton} onPress={() => handleStopAction(stop)}>
                      <Text style={styles.manifestActionText}>
                        {stop.action === "IN_PROGRESS"
                          ? t("liveTracking.dropOff")
                          : stop.action === "AWAITING_OTP"
                          ? t("liveTracking.verifyCode")
                          : t("liveTracking.startPickup")}
                      </Text>
                    </Pressable>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        <View style={styles.actions}>
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
  mapArea: { height: 280, backgroundColor: colors.accentBg },
  carMarker: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF",
  },
  startPin: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 3, borderColor: colors.success, alignItems: "center", justifyContent: "center" },
  startPinDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  endPin: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.danger,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF",
  },
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
  manifestWrap: { marginTop: spacing.lg, gap: spacing.sm },
  manifestTitle: { ...typography.small, color: colors.textMuted, fontWeight: "700", fontFamily: FONT.bold, textTransform: "uppercase", letterSpacing: 0.3 },
  manifestRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.sm,
  },
  manifestName: { ...typography.body, fontWeight: "700", fontFamily: FONT.bold },
  manifestSub: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  manifestDoneBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center" },
  manifestActionButton: { backgroundColor: colors.textPrimary, height: 34, borderRadius: radius.sm, paddingHorizontal: spacing.sm, alignItems: "center", justifyContent: "center" },
  manifestActionText: { ...typography.small, color: "#FFFFFF", fontWeight: "700", fontFamily: FONT.bold },
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
