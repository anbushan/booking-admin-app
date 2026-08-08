-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'TEXT';

-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "vehicleId" TEXT;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "seatCapacity" INTEGER;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
