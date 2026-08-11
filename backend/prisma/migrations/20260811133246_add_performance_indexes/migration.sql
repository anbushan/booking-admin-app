-- CreateIndex
CREATE INDEX "AdminRole_adminId_idx" ON "AdminRole"("adminId");

-- CreateIndex
CREATE INDEX "Booking_rideId_status_idx" ON "Booking"("rideId", "status");

-- CreateIndex
CREATE INDEX "Booking_passengerId_status_idx" ON "Booking"("passengerId", "status");

-- CreateIndex
CREATE INDEX "Booking_expiresAt_idx" ON "Booking"("expiresAt");

-- CreateIndex
CREATE INDEX "CallLog_bookingId_idx" ON "CallLog"("bookingId");

-- CreateIndex
CREATE INDEX "ChatMessage_bookingId_idx" ON "ChatMessage"("bookingId");

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "DriverStrike_driverId_createdAt_idx" ON "DriverStrike"("driverId", "createdAt");

-- CreateIndex
CREATE INDEX "EmergencyContact_userId_idx" ON "EmergencyContact"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "Review_bookingId_idx" ON "Review"("bookingId");

-- CreateIndex
CREATE INDEX "Review_toUserId_idx" ON "Review"("toUserId");

-- CreateIndex
CREATE INDEX "Ride_driverId_idx" ON "Ride"("driverId");

-- CreateIndex
CREATE INDEX "Ride_status_travelDate_idx" ON "Ride"("status", "travelDate");

-- CreateIndex
CREATE INDEX "SosAlert_bookingId_idx" ON "SosAlert"("bookingId");

-- CreateIndex
CREATE INDEX "SosAlert_status_idx" ON "SosAlert"("status");

-- CreateIndex
CREATE INDEX "Vehicle_driverId_idx" ON "Vehicle"("driverId");

-- CreateIndex
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");

