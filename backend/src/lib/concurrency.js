// Runs `fn` over `items` with at most `limit` in flight at once.
//
// Plain `Promise.all(items.map(fn))` is fine for a single ride's bookings
// (naturally bounded by seat count — a handful at most), but the cron
// sweeps in src/cron/ are fallback paths for *missed* events (a Redis TTL
// that never fired, a process restart mid-window). After any outage, the
// stale set can be hundreds of rows across the whole system, and firing
// that many DB writes at the exact same instant risks exhausting Prisma's
// connection pool — shared with every real request the API is serving
// concurrently, not a resource these background sweeps get to themselves.
// This caps the burst instead of assuming the common (small) case is the
// only case, while still running well ahead of a fully sequential loop.
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
