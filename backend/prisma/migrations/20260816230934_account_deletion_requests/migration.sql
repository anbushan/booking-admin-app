-- Google Play requires account deletion be requestable outside the app
-- too (a public web page), not just via the in-app flow — this is that
-- request queue, verified and actioned by an admin before the real
-- deletion (User.deletedAt) happens.
CREATE TABLE "AccountDeletionRequest" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,

    CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountDeletionRequest_processedAt_idx" ON "AccountDeletionRequest"("processedAt");
