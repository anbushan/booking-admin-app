-- Passenger-side Aadhaar verification (additive, safe).
ALTER TABLE "AppConfig" ADD COLUMN "aadhaarVerificationFeeInr" DOUBLE PRECISION NOT NULL DEFAULT 4;

CREATE TABLE "PassengerVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "amountPaidInr" DECIMAL(65,30),
    "paidAt" TIMESTAMP(3),
    "aadhaarStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "aadhaarEkoResponse" JSONB,
    "aadhaarVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassengerVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PassengerVerification_userId_key" ON "PassengerVerification"("userId");

ALTER TABLE "PassengerVerification" ADD CONSTRAINT "PassengerVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
