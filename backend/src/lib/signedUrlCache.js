// Caches R2 presigned *view* URLs by object key — profile photos,
// vehicle photos/RC/DL, driver documents. Every one of those is
// re-fetched far more often than the underlying file ever changes: a
// profile photo shows up again on every screen that shows that user, a
// vehicle's photo/RC re-renders on every focus of VehicleListScreen, etc.
//
// The presigner includes the current timestamp in its signature, so
// signing the exact same key twice a second apart produces two
// genuinely different URL strings — and every client-side image cache
// (React Native's <Image>, a browser's HTTP cache) is keyed on the full
// URL. A "new" URL for unchanged bytes means a full re-download every
// time, even though nothing changed. Serving back the same cached URL
// string for a while is what actually lets those client caches hit —
// this is a server-side fix with zero client-side changes needed.
//
// Same shape as lib/userCache.js/lib/appConfig.js: short-TTL in-memory
// Map, no persistence, correctness comes from the TTL alone (there's
// nothing to "invalidate" here — a re-uploaded photo/document always
// gets a new r2Key, e.g. `${userId}/PHOTO-${Date.now()}`, so a stale
// cached URL for an old key just... never gets requested again).
const CACHE_MS = 4 * 60 * 1000; // 4 min — under every call site's 5 min (300s) signed TTL, so a cache hit still has real time left when it reaches the client.
const cache = new Map(); // r2Key -> { url, cachedAt }

export async function getCachedSignedUrl(key, sign) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.cachedAt < CACHE_MS) return entry.url;

  const url = await sign();
  cache.set(key, { url, cachedAt: Date.now() });

  // Opportunistic sweep instead of a dedicated setInterval — keeps this
  // module self-contained rather than one more timer for index.js to
  // wire up. Only runs on the (relatively rare) cache-miss path, and
  // only once the map has actually grown enough for it to matter.
  if (cache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.cachedAt > CACHE_MS) cache.delete(k);
    }
  }

  return url;
}
