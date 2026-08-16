import { reverseGeocode } from "./geo.js";

// Shared "close enough to count as on this route" tolerance — used both
// for search matching (rides.routes.js matchRideSegment) and for
// resolving a booking's own pickup/drop onto the route at booking-create
// time (bookings.routes.js, lib/segments.js). Deliberately more forgiving
// than the 3-20km maxDetourKm a driver sets for pickup detours — this is
// reconciling two *independent* geocoding lookups of the same real place
// (the driver's publish-time search vs. the passenger's own search), not
// judging how far out of the way a pickup is.
export const MATCH_RADIUS_KM = 8;

// Standard Google encoded-polyline decode (the algorithm Directions/Maps
// use everywhere) — no npm dependency needed for ~20 lines, matching this
// codebase's preference for small inline helpers (see haversineKm in
// rides.routes.js) over pulling in a package for something this size.
export function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let result = 0, shift = 0, b;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0; shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

function haversineKm(lat1, lng1, lat2, lng2) {
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

// Distance from (lat,lng) to the nearest of the polyline's own vertices.
// Good enough at the sample density Directions returns (a polyline point
// roughly every few hundred meters on any road with a bend) without a
// full point-to-segment projection — the extra precision a true segment
// projection would add is well under the detour radius this gets checked
// against anyway.
function nearestPolylineIndex(lat, lng, points) {
  let bestIndex = 0;
  let bestDistanceKm = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = haversineKm(lat, lng, points[i].lat, points[i].lng);
    if (d < bestDistanceKm) {
      bestDistanceKm = d;
      bestIndex = i;
    }
  }
  return { index: bestIndex, distanceKm: bestDistanceKm };
}

export function pointToPolylineDistanceKm(lat, lng, points) {
  return nearestPolylineIndex(lat, lng, points).distanceKm;
}

// Cumulative distance-from-start (km) at the polyline's closest point to
// (lat,lng) — used both for the detour check and for directionality (a
// passenger's drop point must have higher progress than their pickup
// point, or they're going the wrong way for this ride).
export function progressAlongRouteKm(lat, lng, points) {
  const { index, distanceKm } = nearestPolylineIndex(lat, lng, points);
  let cumulativeKm = 0;
  for (let i = 1; i <= index; i++) {
    cumulativeKm += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return { progressKm: cumulativeKm, distanceKm };
}

// STOP_INTERVAL_KM was 15 — meant as a floor to stop short routes from
// producing near-duplicate entries, but at this app's actual route
// lengths (mostly 20-60km intra-metro/intercity trips) it was the thing
// actually limiting stop count, not MAX_STOPS: a 30km route only fits
// ~2 samples 15km apart, so a real 3-stop route (A -> A1 -> A2 -> A3 ->
// B) rendered as A -> A1 -> B, silently dropping A2/A3. Lowered to 5 —
// still enough to avoid redundant points on the shortest qualifying
// routes, but no longer the bottleneck for anything above ~35km.
const STOP_INTERVAL_KM = 5;
const MAX_STOPS = 8;
const MIN_ROUTE_KM_FOR_STOPS = 8;
const ENDPOINT_EXCLUSION_KM = 2;

// Walks a route's steps (each already carrying its own distance/duration
// from Directions — no extra Distance Matrix calls needed) and samples a
// stop roughly every STOP_INTERVAL_KM, reverse-geocoding each sampled
// point to a short place name. Returns stops ordered source -> dest,
// including source and dest themselves as the first/last entries, so a
// passenger's step list is complete end to end.
async function deriveStops(route, sourceAddress, destAddress) {
  const leg = route.legs[0];
  const totalKm = leg.distance.value / 1000;
  const totalMinutes = leg.duration.value / 60;

  const stops = [
    { lat: leg.start_location.lat, lng: leg.start_location.lng, placeName: sourceAddress, distanceKm: 0, durationMinutes: 0 },
  ];

  if (totalKm >= MIN_ROUTE_KM_FOR_STOPS) {
    // STOP_INTERVAL_KM is a floor, not a fixed step — a long route
    // sampled every fixed 15km would hit MAX_STOPS long before reaching
    // the destination (6 stops x 15km = 90km, leaving the rest of a
    // 300km+ route completely unlabeled). Spacing stops evenly across
    // the whole route instead keeps them meaningful end to end; short
    // routes still get at least STOP_INTERVAL_KM between stops so nearby
    // points don't produce redundant near-duplicate entries.
    const stopIntervalKm = Math.max(STOP_INTERVAL_KM, totalKm / (MAX_STOPS + 1));
    let cumulativeKm = 0;
    let cumulativeMinutes = 0;
    let nextSampleAt = stopIntervalKm;

    for (const step of leg.steps) {
      const stepKm = step.distance.value / 1000;
      const stepMinutes = step.duration.value / 60;
      const stepStartKm = cumulativeKm;
      const stepStartMinutes = cumulativeMinutes;
      cumulativeKm += stepKm;
      cumulativeMinutes += stepMinutes;

      while (nextSampleAt < cumulativeKm && stops.length - 1 < MAX_STOPS) {
        // Interpolate within this step — linear is fine at this
        // granularity (a single step is rarely more than a couple km).
        const fraction = stepKm > 0 ? (nextSampleAt - stepStartKm) / stepKm : 0;
        const lat = step.start_location.lat + (step.end_location.lat - step.start_location.lat) * fraction;
        const lng = step.start_location.lng + (step.end_location.lng - step.start_location.lng) * fraction;
        const durationMinutes = Math.round(stepStartMinutes + stepMinutes * fraction);

        const tooCloseToEnd = totalKm - nextSampleAt < ENDPOINT_EXCLUSION_KM;
        if (!tooCloseToEnd) {
          const { placeName } = await reverseGeocode(lat, lng);
          stops.push({ lat, lng, placeName: placeName || "Along the way", distanceKm: Math.round(nextSampleAt), durationMinutes });
        }
        nextSampleAt += stopIntervalKm;
      }
    }
  }

  stops.push({
    lat: leg.end_location.lat,
    lng: leg.end_location.lng,
    placeName: destAddress,
    distanceKm: Math.round(totalKm),
    durationMinutes: Math.round(totalMinutes),
  });

  return stops;
}

async function fetchDirections(sourceLat, sourceLng, destLat, destLng, alternatives) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${sourceLat},${sourceLng}&destination=${destLat},${destLng}&alternatives=${alternatives}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  const response = await fetch(url).catch(() => null);
  if (!response || !response.ok) return null;
  const data = await response.json();
  return data.status === "OK" ? data : null;
}

// GET route alternatives between two points, each with a derived stop
// list. Directions returning just one viable route (common for short or
// simple trips) is expected, not an error — callers show whatever comes
// back.
//
// Asking for alternatives=true is a stricter request than the plain
// single-route query — Google has been observed to come back with
// ZERO_RESULTS for the former while the latter succeeds for the exact
// same origin/destination. Retrying once without alternatives before
// giving up recovers those cases silently (the driver still sees a
// route to publish with, just without any alternate shape to pick
// from) instead of falling straight to the no-polyline/"Publish
// anyway" path on what was actually a routable trip.
export async function getRouteAlternatives(sourceLat, sourceLng, destLat, destLng, sourceAddress, destAddress) {
  const data =
    (await fetchDirections(sourceLat, sourceLng, destLat, destLng, true)) ||
    (await fetchDirections(sourceLat, sourceLng, destLat, destLng, false));
  if (!data) return [];

  const alternatives = [];
  for (const route of data.routes) {
    const leg = route.legs[0];
    const stops = await deriveStops(route, sourceAddress, destAddress);
    alternatives.push({
      summary: route.summary || "Route",
      polyline: route.overview_polyline.points,
      distanceKm: Math.round(leg.distance.value / 1000),
      durationMinutes: Math.round(leg.duration.value / 60),
      stops,
    });
  }
  return alternatives;
}
