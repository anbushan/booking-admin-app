-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "driverLastReadAt" TIMESTAMP(3),
ADD COLUMN     "passengerLastReadAt" TIMESTAMP(3);
