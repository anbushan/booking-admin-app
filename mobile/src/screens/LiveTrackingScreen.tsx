import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Linking, Animated } from "react-native";
import { Pressable } from "../components/Pressable";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import MapView, { Marker, MarkerAnimated, AnimatedRegion, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";
import { decodePolyline, haversineKm, bearingDeg, LatLng } from "../lib/mapGeo";

const STALE_THRESHOLD_MS = 90 * 1000;
const SOS_HOLD_MS = 3000;
const LOCATION_REPORT_INTERVAL_MS = 10 * 1000;
const AVG_SPEED_KMH = 25; // rough city-driving assumption, just for an ETA estimate
const CAR_MOVE_DURATION_MS = 900; // matches the poll cadence closely enough to read as continuous motion

// The three phases of a live trip, shown as a compact progress line at
// the top of the info sheet — the same "where is this now" idea as the
// booking step tracker, just condensed for a screen that's already
// mostly map.
const TRIP_PHASES = ["Trip started", "On the way", "Arriving"];

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
  const { bookingId, role } = route.params; // role: "DRIVER" | "PASSENGER"
  const [lastLocationAt, setLastLocationAt] = useState<string | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [ride, setRide] = useState<{
    sourceLat: number; sourceLng: number; destLat: number; destLng: number;
    sourceAddress: string; destAddress: string; routePolyline: string | null;
  } | null>(null);
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
      if (booking.ride) {
        setRide({
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
            showAlert("Trip completed", `Please pay Rs ${track.amount ?? 0} directly to your driver (cash/UPI).`);
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
          showAlert("Ride closed", "This ride was stopped before reaching the destination.");
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
        showAlert("Help is on the way", "Your emergency contact has been notified.");
      } catch (err: any) {
        showAlert("Couldn't send SOS", err.message);
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
      await Linking.openURL(`tel:${proxyNumber}`);
    } catch (err: any) {
      showError(err.message || "Couldn't start the call");
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
            {isStale ? "Reconnecting..." : etaMinutes != null ? `ETA ${etaMinutes} min` : "Calculating..."}
          </Text>
        </View>
      </View>

      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />

        <Text style={styles.statusTitle}>Trip in progress</Text>

        {/* Zomato-style condensed progress — three phases instead of the
            full multi-step booking tracker, since by this point the trip
            has already started; what's left to communicate is just
            where along the drive it is right now. */}
        <View style={styles.phaseRow}>
          {TRIP_PHASES.map((label, i) => (
            <React.Fragment key={label}>
              <View style={styles.phaseStep}>
                <View style={[styles.phaseDot, i <= phaseIndex && styles.phaseDotActive]}>
                  {i < phaseIndex ? <Ionicons name="checkmark" size={10} color="#FFFFFF" /> : null}
                </View>
                <Text style={[styles.phaseLabel, i <= phaseIndex && styles.phaseLabelActive]}>{label}</Text>
              </View>
              {i < TRIP_PHASES.length - 1 && (
                <View style={[styles.phaseConnector, i < phaseIndex && styles.phaseConnectorActive]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {role !== "DRIVER" && (
          <View style={styles.driverRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(driverName || "D").charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{driverName || "Your driver"}</Text>
              <Text style={styles.driverSub}>{isStale ? "Last known location a moment ago" : "En route to your destination"}</Text>
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
              <Text style={styles.completeButtonText}>Complete trip</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.sosButton, holding && styles.sosButtonHolding]}
            onPressIn={startHold}
            onPressOut={cancelHold}
          >
            <Ionicons name="alert-circle-outline" size={16} color={holding ? "#FFFFFF" : colors.danger} />
            <Text style={[styles.sosText, holding && { color: "#FFFFFF" }]}>
              {holding ? "Keep holding..." : "SOS · hold for help"}
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
  etaText: { ...typography.caption, color: colors.accentText, fontWeight: "700" },
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
  phaseLabelActive: { color: colors.accentText, fontWeight: "700" },
  phaseConnector: { flex: 1, height: 2, backgroundColor: colors.border, marginTop: 9 },
  phaseConnectorActive: { backgroundColor: colors.accent },
  driverRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xl,
    paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.accentText, fontSize: 15, fontWeight: "700" },
  driverName: { ...typography.title, fontSize: 14 },
  driverSub: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  callButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center" },
  actions: { gap: spacing.md, marginTop: spacing.xl },
  completeButton: {
    flexDirection: "row", gap: spacing.xs,
    backgroundColor: colors.accent,
    height: 48,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  completeButtonText: { color: "#FFFFFF", ...typography.title },
  sosButton: {
    flexDirection: "row", gap: 6,
    backgroundColor: colors.dangerBg,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  sosButtonHolding: { backgroundColor: colors.danger },
  sosText: { color: colors.danger, ...typography.title, fontSize: 13 },
});
