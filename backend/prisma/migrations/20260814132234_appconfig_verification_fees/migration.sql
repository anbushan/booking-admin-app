-- Add verification fee columns to AppConfig (additive, safe defaults).
ALTER TABLE "AppConfig" ADD COLUMN "licenseVerificationFeeInr" DOUBLE PRECISION NOT NULL DEFAULT 4;
ALTER TABLE "AppConfig" ADD COLUMN "vehicleRcFeeInr" DOUBLE PRECISION NOT NULL DEFAULT 4;
