import React, { useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../theme/theme";
import { decodePolyline } from "../lib/mapGeo";
import { MapFeatureButtons } from "./MapFeatureButtons";
import { WeatherEffectOverlay } from "./WeatherEffectOverlay";
import { useRouteWeather } from "../lib/useRouteWeather";

type Props = {
  sourceLat: number;
  sourceLng: number;
  destLat: number;
  destLng: number;
  routePolyline?: string | null;
  height?: number;
};

// The inline route preview + Traffic/Weather toggles shared by
// SearchResultsScreen (one per result card), RouteOptionsScreen (one
// per route alternative), and BookingConfirmScreen (the one ride being
// booked) — pulled into its own component for two reasons: it's the
// same ~60 lines three times over otherwise, and — the reason this
// exists at all — a screen that imports react-native-maps directly with
// no .web.tsx sibling breaks Metro's *entire* web bundle at build time,
// not just at runtime (see RouteMapScreen.web.tsx / LiveTrackingScreen
// .web.tsx / TripPickupMap.web.tsx for the same fix already in place
// elsewhere). Routing the import through here, with RouteMiniMap.web.tsx
// as the fallback, means none of the three screens above ever import
// react-native-maps themselves.
export function RouteMiniMap({ sourceLat, sourceLng, destLat, destLng, routePolyline, height = 160 }: Props) {
  const mapRef = useRef<MapView>(null);
  const [showTraffic, setShowTraffic] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const midLat = (sourceLat + destLat) / 2;
  const midLng = (sourceLng + destLng) / 2;
  const weather = useRouteWeather(showWeather, midLat, midLng);
  const coords = routePolyline ? decodePolyline(routePolyline) : [];

  // The naive initialRegion delta below (source/dest midpoint ± a fixed
  // multiplier) uses the same multiplier for both lat and lng regardless
  // of this view's actual aspect ratio — a mini map is wide and short
  // (full card width, ~150-170px tall), so an east-west route and a
  // north-south route need very different framing to both fit, and the
  // naive version silently doesn't give either one enough room, cutting
  // a pin off outside the visible area. fitToCoordinates on layout is
  // what RouteMapScreen already does for exactly this reason — this was
  // missing here, which is the actual bug, not just a smaller version of
  // the same math.
  const fitCoords = coords.length > 1
    ? coords
    : [{ latitude: sourceLat, longitude: sourceLng }, { latitude: destLat, longitude: destLng }];

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsTraffic={showTraffic}
        initialRegion={{
          latitude: midLat,
          longitude: midLng,
          latitudeDelta: Math.max(Math.abs(sourceLat - destLat) * 1.6, 0.03),
          longitudeDelta: Math.max(Math.abs(sourceLng - destLng) * 1.6, 0.03),
        }}
        onLayout={() => mapRef.current?.fitToCoordinates(fitCoords, {
          edgePadding: { top: 28, right: 28, bottom: 28, left: 28 },
          animated: false,
        })}
      >
        {coords.length > 1 && <Polyline coordinates={coords} strokeColor={colors.accent} strokeWidth={4} />}
        <Marker coordinate={{ latitude: sourceLat, longitude: sourceLng }} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.startPin} />
        </Marker>
        <Marker coordinate={{ latitude: destLat, longitude: destLng }} anchor={{ x: 0.5, y: 1 }}>
          <View style={styles.endPin}>
            <Ionicons name="flag" size={10} color="#FFFFFF" />
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
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  map: { flex: 1, borderRadius: radius.sm },
  startPin: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#FFFFFF", borderWidth: 3, borderColor: colors.success },
  endPin: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: colors.danger,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF",
  },
});
