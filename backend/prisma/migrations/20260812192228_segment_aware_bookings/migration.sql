-- Additive, nullable-only columns for segment-aware (interval) seat
-- allocation. Nothing existing is renamed, dropped, or backfilled —
-- every pre-existing Ride/Booking row simply has these as NULL, which
-- application code treats as "this ride/booking uses the old flat-pool
-- behavior forever" (see backend/src/lib/segments.js).

ALTER TABLE "Ride" ADD COLUMN "totalSeats" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "pickupProgressKm" DOUBLE PRECISION;
ALTER TABLE "Booking" ADD COLUMN "dropProgressKm" DOUBLE PRECISION;
