// Turns a raw Prisma enum string ("AWAITING_PAYMENT") into something a
// human reads at a glance ("Awaiting payment") — every status/role/type
// enum in the schema was previously shown verbatim, SHOUTING_CASE, in
// every Badge and in a couple of plain-text spots on the detail pages.
//
// Curated overrides only for values actually shown on the four detail
// pages (Booking/Ride/Refund/CallLog status, PassengerVerification
// payment/aadhaar status, Booking.cancelledBy) — this is deliberately
// not an app-wide enum audit; anything not listed falls through to the
// generic Title Case conversion below, which is a reasonable default
// for values this list doesn't yet know about.
const OVERRIDES: Record<string, string> = {
  // Booking.status
  BOOKED: "Booked",
  AWAITING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  // Ride.status
  PUBLISHED: "Published",
  // Refund.status / payment-style statuses
  REQUESTED: "Requested",
  PROCESSING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
  PENDING: "Pending",
  VERIFIED: "Verified",
  // CallLog.status
  INITIATED: "Initiated",
  RINGING: "Ringing",
  ANSWERED: "Answered",
  NO_ANSWER: "No answer",
  // Booking.cancelledBy
  DRIVER: "Driver",
  PASSENGER: "Passenger",
  ADMIN: "Admin",
};

export function statusLabel(raw: string): string {
  if (OVERRIDES[raw]) return OVERRIDES[raw];
  return raw
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}
