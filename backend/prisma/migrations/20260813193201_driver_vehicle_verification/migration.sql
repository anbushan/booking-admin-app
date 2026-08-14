-- Paid third-party (Eko) driver/vehicle verification — brand new
-- tables, nothing existing touched.

CREATE TABLE "DriverVerification" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "amountPaidInr" DECIMAL(65,30),
    "paidAt" TIMESTAMP(3),
    "licenseStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "licenseEkoResponse" JSONB,
    "licenseVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DriverVerification_driverId_key" ON "DriverVerification"("driverId");

CREATE TABLE "VehicleVerification" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "amountPaidInr" DECIMAL(65,30),
    "paidAt" TIMESTAMP(3),
    "rcStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "rcEkoResponse" JSONB,
    "rcVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehicleVerification_vehicleId_key" ON "VehicleVerification"("vehicleId");

ALTER TABLE "DriverVerification" ADD CONSTRAINT "DriverVerification_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleVerification" ADD CONSTRAINT "VehicleVerification_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
