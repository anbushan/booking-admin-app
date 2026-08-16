import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { useTranslation } from "../lib/i18n/I18nContext";

type Props = {
  driverLat: number | null;
  driverLng: number | null;
  pickupLat: number | null;
  pickupLng: number | null;
};

// Small, inline map for TripOtpScreen — not a full navigate-to screen
// like RouteMapScreen/LiveTrackingScreen, just enough to visually
// confirm "yes, that's the car" against the pickup point, the same
// reassurance Rapido/Uber/Ola give while waiting. Driver position comes
// from trips.routes.js's /:bookingId/track (already polled every 3s by
// TripOtpScreen for the IN_PROGRESS transition — this just also reads
// the lat/lng it was already returning and ignoring), fed by
// StartTripScreen's own ping loop on the driver's device.
export function TripPickupMap({ driverLat, driverLng, pickupLat, pickupLng }: Props) {
  const { t } = useTranslation();
  const mapRef = useRef<MapView>(null);
  const fittedRef = useRef(false);

  const hasDriver = driverLat != null && driverLng != null;
  const hasPickup = pickupLat != null && pickupLng != null;

  useEffect(() => {
    if (fittedRef.current || !mapRef.current || !hasDriver || !hasPickup) return;
    fittedRef.current = true;
    mapRef.current.fitToCoordinates(
      [{ latitude: driverLat!, longitude: driverLng! }, { latitude: pickupLat!, longitude: pickupLng! }],
      { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: false }
    );
  }, [hasDriver, hasPickup, driverLat, driverLng, pickupLat, pickupLng]);

  if (!hasDriver && !hasPickup) return null;

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: (driverLat ?? pickupLat)!,
          longitude: (driverLng ?? pickupLng)!,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {hasPickup && (
          <Marker coordinate={{ latitude: pickupLat!, longitude: pickupLng! }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.pickupDot} />
          </Marker>
        )}
        {hasDriver && (
          <Marker coordinate={{ latitude: driverLat!, longitude: driverLng! }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.carBadge}>
              <Ionicons name="car-sport" size={14} color="#FFFFFF" />
            </View>
          </Marker>
        )}
      </MapView>
      {!hasDriver && (
        <View style={styles.waitingOverlay} pointerEvents="none">
          <Text style={styles.waitingOverlayText}>{t("tripOtp.locatingDriver")}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", height: 160, borderRadius: radius.md, overflow: "hidden", marginTop: spacing.md, backgroundColor: colors.accentBg },
  pickupDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.success, borderWidth: 2, borderColor: "#FFFFFF" },
  carBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.marigold,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF",
  },
  waitingOverlay: { position: "absolute", bottom: spacing.xs, left: spacing.xs, right: spacing.xs, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: radius.sm, padding: spacing.xs, alignItems: "center" },
  waitingOverlayText: { ...typography.small, color: colors.textSecondary },
});
