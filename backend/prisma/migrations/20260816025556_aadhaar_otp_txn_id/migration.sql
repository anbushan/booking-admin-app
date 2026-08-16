-- Aadhaar e-KYC is OTP-consent-based (UIDAI requirement), not a plain
-- lookup like DL/RC — this holds the pending OTP transaction id.
ALTER TABLE "PassengerVerification" ADD COLUMN "aadhaarOtpTxnId" TEXT;
