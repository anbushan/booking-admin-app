import { prisma } from "./prisma.js";

// AppConfig used to be scaffolded but never actually read anywhere in this
// codebase — every route read the equivalent value from an env var
// instead, and the admin config page said as much. This is the single
// place that closes that gap: every route that needs a tunable value
// (fee %, window minutes, strike tiers, etc.) should call getAppConfig()
// instead of reading process.env or hardcoding a number, so an admin edit
// takes effect without a redeploy.
//
// A short in-memory cache avoids a DB round trip on every request (this
// config changes rarely) while still picking up admin edits quickly.
const CACHE_MS = 15 * 1000;
let cache = null;
let cachedAt = 0;

// Defaults mirror the schema's @default values (and the old env vars,
// where one existed) so behavior is unchanged until an AppConfig row
// exists — the admin page creates one on first visit, but nothing forces
// that to happen before the backend starts serving traffic.
const DEFAULTS = {
  platformFeePercent: Number(process.env.PLATFORM_FEE_PERCENT || 10),
  fareCapPerKmInr: Number(process.env.FARE_CAP_PER_KM_INR || 12),
  defaultMaxDetourKm: Number(process.env.DEFAULT_MAX_DETOUR_KM || 3),
  bookingExpiryMinutes: Number(process.env.BOOKING_EXPIRY_MINUTES || 20),
  refundWorkingDays: Number(process.env.REFUND_WORKING_DAYS || 3),
  paymentWindowMinutes: 30,
  graceCancelWindowMinutes: 30,
  noShowGraceMinutes: 15,
  passengerCooldownCancelCount: 3,
  passengerCooldownWindowDays: 7,
  passengerCooldownHours: 24,
  strikeWarningThreshold: 3,
  strikeFinalWarningThreshold: 5,
  strikeBlockThreshold: 7,
  strikeBlockDays: 2,
  strikeRollingWindowDays: 30,
  maintenanceMode: false,
  maintenanceMessage: null,
};

export async function getAppConfig() {
  if (cache && Date.now() - cachedAt < CACHE_MS) return cache;

  const row = await prisma.appConfig.findFirst();
  cache = { ...DEFAULTS, ...(row || {}) };
  cachedAt = Date.now();
  return cache;
}

// Exposed for routes/crons that just fired off a config-changing admin
// action and want the very next read to be fresh (not required anywhere
// today since admin writes directly to the DB, not through this backend,
// but keeps the cache from being a surprise if that ever changes).
export function invalidateAppConfigCache() {
  cache = null;
}
