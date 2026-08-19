// requireAuth (middleware/auth.js) runs on nearly every authenticated
// request, and does a full `prisma.user.findUnique` every single time —
// the mobile app polls several endpoints every few seconds while a trip
// is active (live tracking every 5s, payment-queue every 10s, trip-otp
// every 3s), so the same user's row gets re-fetched from Postgres far
// more often than it actually changes. A short-TTL cache (see lib/
// cache.js) turns that into a single DB round trip every few seconds
// per user instead of one per request.
//
// Short TTL alone isn't enough for correctness, though — role-switching
// (PUT /api/users/me/role) needs the very next request to see the new
// role immediately, not whatever was cached seconds ago, or a driver who
// just switched to passenger could get a stray 403 from requireRole on
// their first request after switching. So this pairs the short TTL with
// *structural* invalidation: lib/prisma.js's $extends hook calls
// invalidateUserCache() on every User write, at the single shared
// client, so no individual route handler has to remember to do it.
//
// Backed by Redis (lib/cache.js), not an in-memory Map — this backend
// runs as several PM2 worker processes behind Nginx (see ecosystem.
// config.js), and a suspend/role-switch on one worker has to be visible
// to every other worker's very next request, not just that one process's
// memory. Deliberately short TTL is still the one real tradeoff of this
// cache: admin (a separate deploy, its own Prisma client — see admin/
// lib/prisma.js) writes User rows directly against the same Postgres
// database when suspending/reinstating an account, and has no way to
// reach into this cache to invalidate it. 3s bounds how long a
// just-suspended user could still make authenticated requests before
// this cache naturally expires and re-fetches — short enough to be a
// non-issue in practice, but worth knowing about rather than discovering
// by surprise.
import { cacheGet, cacheSet, cacheDelPrefix, cacheDel } from "./cache.js";

const CACHE_MS = 3 * 1000;
const KEY_PREFIX = "user:";

export async function getCachedUser(userId) {
  return (await cacheGet(KEY_PREFIX + userId)) ?? null;
}

export async function setCachedUser(user) {
  await cacheSet(KEY_PREFIX + user.id, user, CACHE_MS);
}

// No id (updateMany/deleteMany, where the affected row(s) aren't known)
// clears every cached user rather than being a no-op — staying correct
// is worth an occasional wider-than-necessary cache miss.
export async function invalidateUserCache(userId) {
  if (userId) await cacheDel(KEY_PREFIX + userId);
  else await cacheDelPrefix(KEY_PREFIX);
}
