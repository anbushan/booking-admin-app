-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "routeDistanceKm" DOUBLE PRECISION,
ADD COLUMN     "routeDurationMinutes" INTEGER,
ADD COLUMN     "routeStops" JSONB;
