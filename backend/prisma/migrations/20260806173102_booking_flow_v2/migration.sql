-- AlterTable
ALTER TABLE "AppConfig" DROP COLUMN "commissionPercent",
ADD COLUMN     "graceCancelWindowMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "noShowGraceMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "passengerCooldownCancelCount" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "passengerCooldownHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "passengerCooldownWindowDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "paymentWindowMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "platformFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
ADD COLUMN     "strikeBlockDays" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "strikeBlockThreshold" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "strikeFinalWarningThreshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "strikeRollingWindowDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "strikeWarningThreshold" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" TEXT,
ADD COLUMN     "expiryReason" TEXT,
ADD COLUMN     "platformFeeAmount" DECIMAL(65,30),
ADD COLUMN     "platformFeePaidAt" TIMESTAMP(3),
ADD COLUMN     "remainingFareAmount" DECIMAL(65,30),
ADD COLUMN     "remainingFareCollectedAt" TIMESTAMP(3),
ADD COLUMN     "tripStoppedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bookingCooldownUntil" TIMESTAMP(3),
ADD COLUMN     "strikeBlockedUntil" TIMESTAMP(3),
ADD COLUMN     "strikeFlagged" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DriverStrike" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "bookingId" TEXT,
    "rideId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverStrike_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DriverStrike" ADD CONSTRAINT "DriverStrike_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
