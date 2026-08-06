import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Simple distributed lock helper — used to serialize seat-count updates
// so two simultaneous bookings on the last seat can't both succeed.
// Returns a release() function, or null if the lock couldn't be acquired.
export async function acquireLock(key, ttlMs = 5000) {
  const token = Math.random().toString(36).slice(2);
  const ok = await redis.set(`lock:${key}`, token, "PX", ttlMs, "NX");
  if (!ok) return null;
  return async () => {
    // Only release if we still own the lock (avoid releasing someone else's).
    const val = await redis.get(`lock:${key}`);
    if (val === token) await redis.del(`lock:${key}`);
  };
}
