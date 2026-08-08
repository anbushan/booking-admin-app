import { redis } from "./redis.js";

// Coordinates rounded to 2 decimal places (~1km) — plenty precise for a
// country check (nowhere near border-sensitive at that scale), and lets
// repeated checks near the same spot (a driver's usual pickup point,
// a popular route) share one cached result instead of re-hitting Google.
function cacheKey(lat, lng) {
  return `geo:country:${Number(lat).toFixed(2)},${Number(lng).toFixed(2)}`;
}

const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days — a coordinate's country doesn't change

// Reuses the same Geocoding API endpoint places.routes.js's own
// /reverse route calls, just reading the `country` address_component
// instead of the formatted address.
//
// Fails OPEN (returns true) if the Geocoding call itself errors — this
// is a product policy guard ("rides are India-only for now"), not a
// fraud/security boundary, so an API hiccup or quota blip shouldn't
// block an otherwise-legitimate ride or booking.
export async function isWithinIndia(lat, lng) {
  const key = cacheKey(lat, lng);
  const cached = await redis.get(key);
  if (cached !== null) return cached === "1";

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`
  ).catch(() => null);
  if (!response || !response.ok) return true;

  const data = await response.json();
  const components = data.results?.[0]?.address_components || [];
  const country = components.find((c) => c.types?.includes("country"));
  // No country component at all (open ocean, no geocoding coverage) —
  // fail open rather than reject a coordinate we couldn't classify.
  const isIndia = country ? country.short_name === "IN" : true;

  await redis.set(key, isIndia ? "1" : "0", "EX", CACHE_TTL_SECONDS);
  return isIndia;
}

function reverseGeocodeCacheKey(lat, lng) {
  return `geo:reverse:${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}`;
}

// One shared reverse-geocode call (one Geocoding API request, one cache
// entry) returning both the full formatted address — what
// places.routes.js's /reverse route has always returned, e.g. for
// confirming a dropped map pin — and a short, human-recognizable place
// name ("Trichy", not the full street address), used to label the
// auto-detected stops along a route (see lib/directions.js). Prefers
// locality (town/city) for the short name, then the next-broadest
// administrative area, falling back to the full address if neither
// address_component is present (rural/unnamed areas). Same fail-open-ish
// posture as isWithinIndia: an API error just means no result, not a
// thrown error — a missing stop label shouldn't break the whole route
// computation, and a failed pin-confirm shouldn't 500 the caller either
// (callers already handle a null/missing result their own way).
export async function reverseGeocode(lat, lng) {
  const key = reverseGeocodeCacheKey(lat, lng);
  const cached = await redis.get(key);
  if (cached !== null) return JSON.parse(cached);

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`
  ).catch(() => null);
  if (!response || !response.ok) return { address: null, placeName: null };

  const data = await response.json();
  const components = data.results?.[0]?.address_components || [];
  const find = (type) => components.find((c) => c.types?.includes(type));
  const address = data.results?.[0]?.formatted_address || null;
  const placeName =
    find("locality")?.long_name ||
    find("administrative_area_level_2")?.long_name ||
    find("sublocality")?.long_name ||
    address;

  const result = { address, placeName };
  if (address) await redis.set(key, JSON.stringify(result), "EX", CACHE_TTL_SECONDS);
  return result;
}
