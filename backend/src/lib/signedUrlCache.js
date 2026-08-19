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
// Same shape as lib/userCache.js/lib/appConfig.js: short-TTL Redis cache
// (lib/cache.js), no persistence beyond the TTL, correctness comes from
// the TTL alone (there's nothing to "invalidate" here — a re-uploaded
// photo/document always gets a new r2Key, e.g. `${userId}/PHOTO-
// ${Date.now()}`, so a stale cached URL for an old key just... never
// gets requested again). Redis instead of a plain in-memory Map for the
// same reason as the other two caches: this backend runs as several PM2
// worker processes, and each one hitting R2 for its own copy of the same
// signature would waste exactly the round trips this cache exists to
// avoid.
import { cacheGet, cacheSet } from "./cache.js";

const CACHE_MS = 4 * 60 * 1000; // 4 min — under every call site's 5 min (300s) signed TTL, so a cache hit still has real time left when it reaches the client.
const KEY_PREFIX = "signed-url:";

export async function getCachedSignedUrl(key, sign) {
  const cached = await cacheGet(KEY_PREFIX + key);
  if (cached) return cached;

  const url = await sign();
  await cacheSet(KEY_PREFIX + key, url, CACHE_MS);
  return url;
}
