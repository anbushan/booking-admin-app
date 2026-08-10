-- AlterTable
ALTER TABLE "User" ADD COLUMN     "photoR2Key" TEXT;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "dlR2Key" TEXT,
ADD COLUMN     "photoR2Key" TEXT,
ADD COLUMN     "rcR2Key" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- Backfill: every vehicle added before this migration was usable
-- immediately (there was no approval step at all) — grandfather them
-- in as APPROVED so no currently-active driver is retroactively
-- blocked from publishing with a vehicle they already had in use.
UPDATE "Vehicle" SET "status" = 'APPROVED', "reviewedAt" = now();
