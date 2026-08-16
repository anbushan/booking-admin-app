// Extracted from rides.routes.js so recurringRides.routes.js (and its
// generation job) can apply the exact same fare-cap rule to a
// recurring series' template — was a private function, no behavior
// change from moving it here.

// Rough point-to-line-segment distance in km (haversine-based). Good
// enough for a "within N km" check without a full polyline decode.
export function haversineKm(lat1, lng1, lat2, lng2) {
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

// Fare cap — the regulatory line between genuine cost-sharing carpooling
// (exempt from taxi-aggregator licensing in most Indian states) and an
// unlicensed commercial passenger service. A driver setting price freely
// with no ceiling tied to actual trip cost looks like the latter. This
// caps pricePerSeat at a generous per-km rate covering fuel, tolls, and
// wear — not a tight commercial fare, just an upper bound that keeps the
// "cost-sharing, not profit" framing defensible.
// routeDistanceKm (real Directions API distance, when a route's been
// computed) takes priority over the straight-line guess when given — an
// actual driving distance is always at least the straight-line one, so
// this only ever makes the cap more generous, never stricter, relative
// to what a ride without route data gets.
export function computeFareCap(sourceLat, sourceLng, destLat, destLng, fareCapPerKmInr, routeDistanceKm) {
  const distanceKm = routeDistanceKm ?? haversineKm(sourceLat, sourceLng, destLat, destLng);
  return Math.round(distanceKm * fareCapPerKmInr);
}
