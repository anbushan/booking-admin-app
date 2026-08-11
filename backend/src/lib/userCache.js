// requireAuth (middleware/auth.js) runs on nearly every authenticated
// request, and does a full `prisma.user.findUnique` every single time —
// the mobile app polls several endpoints every few seconds while a trip
// is active (live tracking every 5s, payment-queue every 10s, trip-otp
// every 3s), so the same user's row gets re-fetched from Postgres far
// more often than it actually changes. A short-TTL in-memory cache
// (same pattern as getAppConfig in lib/appConfig.js) turns that into a
// single DB round trip every few seconds per user instead of one per
// request.
//
// Short TTL alone isn't enough for correctness, though — role-switching
// (PUT /api/users/me/role) needs the very next request to see the new
// role immediately, not whatever was cached seconds ago, or a driver who
// just switched to passenger could get a stray 403 from requireRole on
// their first request after switching. So this pairs the short TTL with
// *structural* invalidation: lib/prisma.js's $extends hook calls
// invalidateUserCache() on every User write, at the single shared
// client, so no individual route handler has to remember to do it.
// Deliberately short, and this is the one real tradeoff of this cache:
// admin (a separate process, its own Prisma client — see admin/lib/
// prisma.js) writes User rows directly against the same Postgres
// database when suspending/reinstating an account. Every write that
// goes through *this* backend's own prisma export invalidates
// correctly (see the $extends hook in lib/prisma.js — checked against
// role-switch, self-delete, and the $transaction([...]) array form),
// but an admin-side suspend has no way to reach into this process's
// memory to do the same. 3s bounds how long a just-suspended user could
// still make authenticated requests before this cache naturally expires
// and re-fetches — short enough to be a non-issue in practice, but
// worth knowing about rather than discovering by surprise.
const CACHE_MS = 3 * 1000;
const cache = new Map(); // userId -> { user, cachedAt }

export function getCachedUser(userId) {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_MS) {
    cache.delete(userId);
    return null;
  }
  return entry.user;
}

export function setCachedUser(user) {
  cache.set(user.id, { user, cachedAt: Date.now() });
}

// No id (updateMany/deleteMany, where the affected row(s) aren't known)
// clears every entry rather than being a no-op — staying correct is
// worth an occasional wider-than-necessary cache miss.
export function invalidateUserCache(userId) {
  if (userId) cache.delete(userId);
  else cache.clear();
}
