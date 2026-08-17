import React, { useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { decodePolyline } from "../lib/mapGeo";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";
import { MapFeatureButtons } from "../components/MapFeatureButtons";
import { WeatherEffectOverlay } from "../components/WeatherEffectOverlay";
import { useRouteWeather } from "../lib/useRouteWeather";

// A static, non-live view of a route — reused from every screen that
// currently only shows the route as text/stops (search results, a
// booking's confirm screen, a driver's route-alternative cards before
// publishing) so "what does this actually look like on a map" doesn't
// require waiting until a trip is already in progress to find out
// (LiveTrackingScreen is the *live*, in-trip version of this same idea).
export default function RouteMapScreen({ route, navigation }: any) {
  useScreenView("RouteMapScreen");
  const { t } = useTranslation();
  const {
    sourceLat, sourceLng, sourceAddress,
    destLat, destLng, destAddress,
    routePolyline,
  } = route.params;
  const mapRef = useRef<MapView>(null);
  const [showTraffic, setShowTraffic] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  // Weather at the route's midpoint — close enough for a whole-route
  // background effect (this isn't per-stop granular, it's "what's it
  // like out there right now"), and one call instead of one per stop.
  const midLat = (sourceLat + destLat) / 2;
  const midLng = (sourceLng + destLng) / 2;
  const weather = useRouteWeather(showWeather, midLat, midLng);

  // Falls back to a straight line between the two points whenever no
  // computed route is stored (a legacy ride, or a not-yet-selected
  // route-options alternative that only carries its own polyline) —
  // still shows something, just without the actual road shape.
  const coords = routePolyline ? decodePolyline(routePolyline) : [
    { latitude: sourceLat, longitude: sourceLng },
    { latitude: destLat, longitude: destLng },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("routeMap.title")} onBack={() => navigation.goBack()} />
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          showsTraffic={showTraffic}
          initialRegion={{
            latitude: (sourceLat + destLat) / 2,
            longitude: (sourceLng + destLng) / 2,
            latitudeDelta: Math.max(Math.abs(sourceLat - destLat) * 1.6, 0.03),
            longitudeDelta: Math.max(Math.abs(sourceLng - destLng) * 1.6, 0.03),
          }}
          onLayout={() => mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 80, right: 60, bottom: 160, left: 60 },
            animated: false,
          })}
        >
          {coords.length > 1 && <Polyline coordinates={coords} strokeColor={colors.accent} strokeWidth={4} />}
          <Marker coordinate={{ latitude: sourceLat, longitude: sourceLng }} title={t("routeMap.pickup")} description={sourceAddress} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.startPin}>
              <View style={styles.startPinDot} />
            </View>
          </Marker>
          <Marker coordinate={{ latitude: destLat, longitude: destLng }} title={t("routeMap.dropoff")} description={destAddress} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.endPin}>
              <Ionicons name="flag" size={14} color="#FFFFFF" />
            </View>
          </Marker>
        </MapView>

        {showWeather && weather.condition && <WeatherEffectOverlay condition={weather.condition} />}

        <MapFeatureButtons
          showTraffic={showTraffic}
          onToggleTraffic={() => setShowTraffic((v) => !v)}
          showWeather={showWeather}
          onToggleWeather={() => (weather.error ? weather.retry() : setShowWeather((v) => !v))}
          weatherLoading={showWeather && weather.loading}
          weatherTempC={weather.tempC}
          weatherError={showWeather && weather.error}
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <Text style={styles.footerText} numberOfLines={1}>{sourceAddress}</Text>
        </View>
        <View style={styles.footerRow}>
          <View style={[styles.dot, { backgroundColor: colors.danger }]} />
          <Text style={styles.footerText} numberOfLines={1}>{destAddress}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  startPin: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 3, borderColor: colors.success, alignItems: "center", justifyContent: "center" },
  startPinDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  endPin: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.danger,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF",
  },
  footer: {
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    padding: spacing.md, gap: spacing.xs,
  },
  footerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footerText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
});
