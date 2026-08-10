-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isDriver" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPassenger" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every existing account already has exactly one role in
-- practice (there was no way to have both before this migration) — set
-- the matching flag from the role they're already using so nothing
-- about their login changes.
UPDATE "User" SET "isDriver" = true WHERE "role" = 'DRIVER';
UPDATE "User" SET "isPassenger" = true WHERE "role" = 'PASSENGER';
