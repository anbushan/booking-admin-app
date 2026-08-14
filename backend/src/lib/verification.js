import { prisma } from "./prisma.js";

// "Verified" has two independent paths to the same badge: the new paid
// Eko flow (DriverVerification.licenseStatus === "VERIFIED"), or the
// pre-existing manual admin-review path (every Document row APPROVED —
// same check rides.routes.js search already did before this existed).
// Neither replaces the other — an admin-approved driver from before
// this shipped still reads as verified; a driver who pays for the
// faster Eko path doesn't need an admin to also review them.
export async function isDriverVerified(driverId) {
  const dv = await prisma.driverVerification.findUnique({ where: { driverId } });
  if (dv?.licenseStatus === "VERIFIED") return true;
  const docs = await prisma.document.findMany({ where: { userId: driverId } });
  return docs.length > 0 && docs.every((d) => d.status === "APPROVED");
}

// Same "either path counts" logic as isDriverVerified above, but for a
// single vehicle's RC specifically — the Eko-paid VehicleVerification
// row, or the pre-existing manual admin-approved Vehicle.status. Used
// wherever a booking/ride needs to show RC and license as two distinct
// badges (BookingConfirmScreen) rather than one combined "driverVerified".
// Named isVehicleRcVerified (not isRcVerified) to avoid colliding with
// lib/eko.js's isRcVerified(raw) — same name, unrelated signature/purpose.
export async function isVehicleRcVerified(vehicle) {
  if (!vehicle) return false;
  if (vehicle.status === "APPROVED") return true;
  const vv = await prisma.vehicleVerification.findUnique({ where: { vehicleId: vehicle.id } });
  return vv?.rcStatus === "VERIFIED";
}

// Passenger-side identity check (Aadhaar) — no legacy manual-review
// fallback exists here (there was never a Document docType for this,
// unlike license/RC), so it's just the one Eko-paid path.
export async function isPassengerVerified(userId) {
  const pv = await prisma.passengerVerification.findUnique({ where: { userId } });
  return pv?.aadhaarStatus === "VERIFIED";
}

// Batched version for a list endpoint (a driver's incoming requests)
// that needs this per-row without a query-per-passenger.
export async function verifiedPassengerIdsBatch(userIds) {
  const unique = [...new Set(userIds)];
  if (!unique.length) return new Set();
  const rows = await prisma.passengerVerification.findMany({
    where: { userId: { in: unique }, aadhaarStatus: "VERIFIED" },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

// Batched version for a list endpoint (search results, booking lists)
// that needs this per-row without a query-per-driver — same shape as
// photoViewUrlsByUser (lib/photo.js).
export async function verifiedDriverIdsBatch(driverIds) {
  const unique = [...new Set(driverIds)];
  if (!unique.length) return new Set();

  const [verifications, docs] = await Promise.all([
    prisma.driverVerification.findMany({
      where: { driverId: { in: unique }, licenseStatus: "VERIFIED" },
      select: { driverId: true },
    }),
    prisma.document.findMany({ where: { userId: { in: unique } } }),
  ]);

  const verified = new Set(verifications.map((v) => v.driverId));

  const docsByDriver = new Map();
  for (const doc of docs) {
    if (!docsByDriver.has(doc.userId)) docsByDriver.set(doc.userId, []);
    docsByDriver.get(doc.userId).push(doc);
  }
  for (const id of unique) {
    if (verified.has(id)) continue;
    const list = docsByDriver.get(id) || [];
    if (list.length > 0 && list.every((d) => d.status === "APPROVED")) verified.add(id);
  }
  return verified;
}

// Both called from the Razorpay webhook (payments.routes.js) once a
// verification-fee payment (not a booking's platform fee) is captured —
// separate from confirmPlatformFeePayment there, which is booking-scoped.
// Idempotency is the caller's job (same pattern as confirmPlatformFeePayment:
// check paymentStatus before calling), not re-checked here.
export async function confirmDriverVerificationPayment(driverVerificationId, paymentId, amountInr) {
  await prisma.driverVerification.update({
    where: { id: driverVerificationId },
    data: { paymentStatus: "PAID", razorpayPaymentId: paymentId, amountPaidInr: amountInr, paidAt: new Date() },
  });
}

export async function confirmVehicleVerificationPayment(vehicleVerificationId, paymentId, amountInr) {
  await prisma.vehicleVerification.update({
    where: { id: vehicleVerificationId },
    data: { paymentStatus: "PAID", razorpayPaymentId: paymentId, amountPaidInr: amountInr, paidAt: new Date() },
  });
}

export async function confirmPassengerVerificationPayment(passengerVerificationId, paymentId, amountInr) {
  await prisma.passengerVerification.update({
    where: { id: passengerVerificationId },
    data: { paymentStatus: "PAID", razorpayPaymentId: paymentId, amountPaidInr: amountInr, paidAt: new Date() },
  });
}
