-- Recurring ride publishing ("repeat this ride every weekday") — additive, safe.
CREATE TABLE "RecurringRideTemplate" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "sourceLat" DOUBLE PRECISION NOT NULL,
    "sourceLng" DOUBLE PRECISION NOT NULL,
    "sourceAddress" TEXT NOT NULL,
    "destLat" DOUBLE PRECISION NOT NULL,
    "destLng" DOUBLE PRECISION NOT NULL,
    "destAddress" TEXT NOT NULL,
    "routePolyline" TEXT,
    "routeStops" JSONB,
    "routeDistanceKm" DOUBLE PRECISION,
    "routeDurationMinutes" INTEGER,
    "maxDetourKm" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "departureTime" TEXT NOT NULL,
    "seatsAvailable" INTEGER NOT NULL,
    "pricePerSeat" DECIMAL(65,30) NOT NULL,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "daysOfWeek" INTEGER[],
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringRideTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecurringRideTemplate_driverId_idx" ON "RecurringRideTemplate"("driverId");
CREATE INDEX "RecurringRideTemplate_active_idx" ON "RecurringRideTemplate"("active");

ALTER TABLE "RecurringRideTemplate" ADD CONSTRAINT "RecurringRideTemplate_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringRideTemplate" ADD CONSTRAINT "RecurringRideTemplate_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Ride" ADD COLUMN "recurringTemplateId" TEXT;
CREATE INDEX "Ride_recurringTemplateId_idx" ON "Ride"("recurringTemplateId");
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "RecurringRideTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
