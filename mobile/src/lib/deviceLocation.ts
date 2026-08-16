import * as Location from "expo-location";

// Shared by every screen that needs the device's own current GPS fix
// directly (not a backend-geocoded address) — originally only
// LiveTrackingScreen's driver-side location-ping loop, now also
// StartTripScreen's (see its own ping loop for why). Requests
// foreground permission on demand rather than assuming
// LocationPermissionPrimingScreen already ran — a driver who denied it
// at signup but grants it later shouldn't be stuck forever.
//
// Raw coordinates only — unlike lib/api.ts's getCurrentLocation (used
// for pickup-point selection), this deliberately skips the
// reverse-geocode-to-an-address step, which would otherwise fire an
// extra Google Geocoding call every single ping. expo-location falls
// back to the browser's own Geolocation API on web, so this works the
// same way there as it does on native.
export async function getDeviceCoords() {
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
