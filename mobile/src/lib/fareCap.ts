// Mirrors backend/src/routes/rides.routes.js's haversineKm() + fare cap
// calculation exactly, so the app can show the real constraint to the
// driver *before* they submit rather than only after a 400 comes back.
// FARE_CAP_PER_KM_INR isn't exposed to the client (it's a server .env
// value, no public config endpoint yet) — 12 mirrors the current default
// in backend/.env.example; if that's changed server-side, update here too.
const FARE_CAP_PER_KM_INR = 12;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computeFareCap(sourceLat: number, sourceLng: number, destLat: number, destLng: number) {
  const distanceKm = haversineKm(sourceLat, sourceLng, destLat, destLng);
  return Math.round(distanceKm * FARE_CAP_PER_KM_INR);
}
