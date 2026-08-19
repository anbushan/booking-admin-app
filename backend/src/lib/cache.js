import { redis } from "./redis.js";

// Shared JSON-over-Redis helper backing userCache.js / appConfig.js /
// signedUrlCache.js. Those three used to be plain in-memory `Map`s —
// fine for a single process, but this backend is moving to PM2 cluster
// mode behind Nginx (see ecosystem.config.js / deploy/nginx.conf), which
// runs several independent Node processes on the same box. An in-memory
// Map is per-process: a cache write (or an invalidation!) in worker 2
// is invisible to workers 0/1/3, so the exact correctness story each of
// those caches carefully documented (e.g. userCache.js's "role-switch
// needs the very next request to see it") quietly breaks the instant
// there's more than one worker — a request could land on a worker that
// never saw the invalidation and keep serving a stale/suspended user.
// Redis is the one piece of state every worker already shares, so it's
// the natural fix: same short-TTL shape, same call sites, now correct
// across every worker (and every box, if this ever scales past one).
const PREFIX = "cache:";

export async function cacheGet(key) {
  const raw = await redis.get(PREFIX + key);
  if (raw == null) return undefined; // undefined = miss; distinct from a cached `null` value
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export async function cacheSet(key, value, ttlMs) {
  await redis.set(PREFIX + key, JSON.stringify(value), "PX", ttlMs);
}

export async function cacheDel(key) {
  await redis.del(PREFIX + key);
}

// For the "no id, clear everything" case (bulk updateMany/deleteMany) —
// Map.clear()'s equivalent. SCAN instead of KEYS so a large keyspace
// doesn't block Redis for other traffic while this runs.
export async function cacheDelPrefix(prefix) {
  const pattern = `${PREFIX}${prefix}*`;
  const stream = redis.scanStream({ match: pattern, count: 200 });
  const keys = [];
  for await (const batch of stream) keys.push(...batch);
  if (keys.length) await redis.del(keys);
}
