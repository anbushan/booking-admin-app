// Shared by NotificationsScreen (tapping a row in the in-app list) and
// the OS push-notification tap handler (see AppSocketBridge) — same
// "which screen does this notification actually mean" mapping, so a
// tap does the same useful thing regardless of which of the two ways
// someone tapped it.
//
// Tapping a notification used to just mark it read and go nowhere — the
// whole point of "New booking request" is to get the driver to the
// screen where they can actually accept/reject it, not to sit there
// read. Every type below either has an obvious, more useful destination
// than a generic "view this booking" screen (a driver needs to act on a
// new request; a passenger mid-pickup needs the OTP), or falls through
// to BookingDetail, which needs nothing but the bookingId already on
// every booking-scoped notification. Account-level notices (driver
// strikes, passenger cooldown, promotions) have no bookingId and no
// natural destination — those just mark read in place / open Home.
export function resolveNotificationTarget(
  type: string,
  bookingId: string | null | undefined,
  myRole?: string
): { screen: string; params?: Record<string, any> } | null {
  if (type === "NEW_BOOKING_REQUEST") return { screen: "BookingRequests" };
  if (!bookingId) return null;
  if (type === "DRIVER_ARRIVED") return { screen: "TripOtp", params: { bookingId } };
  if (type === "NEW_MESSAGE") {
    return { screen: "ChatDetail", params: { bookingId, calleeRole: myRole === "DRIVER" ? "PASSENGER" : "DRIVER" } };
  }
  return { screen: "BookingDetail", params: { bookingId } };
}
