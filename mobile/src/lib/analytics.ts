// Lightweight analytics wrapper. In a real build, swap the body of
// logEvent() for the actual SDK call once you've set up a custom EAS dev
// client (needed either way, alongside Maps/Razorpay/FCM):
//
//   import analytics from "@react-native-firebase/analytics";
//   export async function logEvent(name, params = {}) {
//     await analytics().logEvent(name, params);
//   }
//
// Firebase Analytics automatically forwards events to GA4 — no separate
// GA SDK integration needed once Firebase is wired in. Until then, this
// logs to the console in dev so event-firing call sites can be verified
// without the native module.

const ANALYTICS_ENABLED = false; // flip once @react-native-firebase/analytics is set up

export async function logEvent(name: string, params: Record<string, any> = {}) {
  if (!ANALYTICS_ENABLED) {
    console.log(`[analytics] ${name}`, params);
    return;
  }
  // TODO: real analytics().logEvent(name, params) call goes here.
}

export async function setUserId(userId: string | null) {
  if (!ANALYTICS_ENABLED) {
    console.log(`[analytics] setUserId`, userId);
    return;
  }
  // TODO: real analytics().setUserId(userId) call goes here.
}

export async function setUserProperty(name: string, value: string | null) {
  if (!ANALYTICS_ENABLED) {
    console.log(`[analytics] setUserProperty ${name}`, value);
    return;
  }
  // TODO: real analytics().setUserProperty(name, value) call goes here.
}

// Named event helpers — keeps call sites readable and event names
// consistent instead of ad hoc strings scattered across screens.
export const Analytics = {
  appOpen: () => logEvent("app_open"),
  signUp: (role: string) => logEvent("sign_up", { role }),
  login: () => logEvent("login"),
  logout: () => logEvent("logout"),
  searchRides: (params: { seats: number }) => logEvent("search_rides", params),
  viewRideDetails: (rideId: string) => logEvent("view_ride_details", { ride_id: rideId }),
  bookingCreated: (rideId: string, seats: number) =>
    logEvent("booking_created", { ride_id: rideId, seats }),
  bookingAccepted: (bookingId: string) => logEvent("booking_accepted", { booking_id: bookingId }),
  bookingRejected: (bookingId: string) => logEvent("booking_rejected", { booking_id: bookingId }),
  bookingCancelled: (bookingId: string, role: string) =>
    logEvent("booking_cancelled", { booking_id: bookingId, role }),
  ridePublished: (rideId: string) => logEvent("ride_published", { ride_id: rideId }),
  rideCancelled: (rideId: string) => logEvent("ride_cancelled", { ride_id: rideId }),
  tripStarted: (bookingId: string) => logEvent("trip_started", { booking_id: bookingId }),
  tripCompleted: (bookingId: string) => logEvent("trip_completed", { booking_id: bookingId }),
  paymentSuccess: (bookingId: string, amount: number) =>
    logEvent("payment_success", { booking_id: bookingId, amount }),
  paymentFailed: (bookingId: string) => logEvent("payment_failed", { booking_id: bookingId }),
  sosTriggered: (bookingId: string) => logEvent("sos_triggered", { booking_id: bookingId }),
  reviewSubmitted: (rating: number) => logEvent("review_submitted", { rating }),
  vehicleAdded: () => logEvent("vehicle_added"),
  emergencyContactAdded: () => logEvent("emergency_contact_added"),
  documentUploaded: (docType: string) => logEvent("document_uploaded", { doc_type: docType }),
  languageChanged: (locale: string) => logEvent("language_changed", { locale }),
};
