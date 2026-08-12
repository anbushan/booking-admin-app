import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { reportNetworkError } from "./networkStatus";
import { appEvents } from "./appEvents";
import { setErrorTrackingUser } from "./errorTracking";

// Production backend on Railway (see backend/README or the deploy notes for
// how this got provisioned — Neon Postgres + Railway-hosted Redis, both
// wired in via Railway env vars, not this file).
// To point at a local backend during development instead, swap this for
// your machine's LAN IP (not localhost — a physical device can't reach
// that): run `ipconfig getifaddr en0` to find it.
// Exported so lib/socket.ts and LanguageSelectionScreen.tsx share this one
// value instead of keeping their own copies in sync by hand (they used to,
// and drifted — a stuck-on-"Sending..." OTP screen was one symptom).
export const API_BASE_URL = "https://carpool-backend-api-production.up.railway.app";

async function request(path: string, options: RequestInit = {}) {
  const token = await AsyncStorage.getItem("authToken");

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    // fetch() itself rejecting means the request never reached a server
    // at all (offline, DNS failure, server down) — a different failure
    // mode than a normal 4xx/5xx response, and worth a clear, consistent
    // "no connection" modal rather than whatever raw message fetch()
    // throws surfacing wherever a given screen happens to render errors.
    reportNetworkError();
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  // Two different error shapes come back from the backend: a single
  // `error` string (most routes) or an `errors` array (anything going
  // through lib/validate.js's field-rule validator — see e.g. PUT
  // /api/users/me). Only handling `data.error` meant every validation
  // failure fell through to the generic "Request failed: 400" fallback
  // instead of the actual field message, which is what made the
  // RegisterScreen email bug so hard to diagnose from the UI alone.
  if (!res.ok) throw new Error(data.error || data.errors?.[0] || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  // Public, no auth — checked once at launch (SplashScreen) so a
  // maintenance-mode toggle in admin blocks the app without needing an
  // app-store update.
  getAppStatus: () => request("/api/app-status"),

  sendOtp: (phone: string) =>
    request("/api/auth/send-otp", { method: "POST", body: JSON.stringify({ phone }) }),

  verifyOtp: (phone: string, otp: string, whatsappOptIn?: boolean) =>
    request("/api/auth/verify-otp", { method: "POST", body: JSON.stringify({ phone, otp, whatsappOptIn }) }),

  // Alternative to OTP for a returning login — see auth.routes.js.
  verifyPasscode: (phone: string, passcode: string, whatsappOptIn?: boolean) =>
    request("/api/auth/verify-passcode", { method: "POST", body: JSON.stringify({ phone, passcode, whatsappOptIn }) }),

  generatePasscode: () =>
    request("/api/auth/passcode/generate", { method: "POST" }),

  revokePasscode: () =>
    request("/api/auth/passcode/revoke", { method: "POST" }),

  updateProfile: (payload: { name: string; email?: string; role: "PASSENGER" | "DRIVER"; whatsappOptIn?: boolean }) =>
    request("/api/users/me", { method: "PUT", body: JSON.stringify(payload) }),

  // Lets DeleteAccountScreen show exactly what's blocking deletion (if
  // anything) before the user reaches the confirm step.
  getDeletionCheck: () => request("/api/users/me/deletion-check"),

  deleteAccount: () => request("/api/users/me", { method: "DELETE" }),

  // Switches which profile is active on this phone number, or sets up
  // the other one for the first time — see users.routes.js PUT /me/role.
  switchRole: (role: "PASSENGER" | "DRIVER") =>
    request("/api/users/me/role", { method: "PUT", body: JSON.stringify({ role }) }),

  addVehicle: (payload: {
    make: string; model: string; regNumber: string; color?: string; seatCapacity?: number;
    photoR2Key?: string; rcR2Key: string; dlR2Key?: string;
  }) =>
    request("/api/vehicles", { method: "POST", body: JSON.stringify(payload) }),

  // kind: "PHOTO" | "RC" | "DL" — see vehicles.routes.js.
  getVehicleUploadUrl: (kind: "PHOTO" | "RC" | "DL") =>
    request("/api/vehicles/upload-url", { method: "POST", body: JSON.stringify({ kind }) }),

  getVehicleViewUrls: (vehicleId: string) =>
    request(`/api/vehicles/${vehicleId}/view-urls`),

  getProfilePhotoUploadUrl: () =>
    request("/api/users/me/photo-upload-url", { method: "POST" }),

  createRide: (payload: {
    sourceLat: number; sourceLng: number; sourceAddress: string;
    destLat: number; destLng: number; destAddress: string;
    travelDate: string; seatsAvailable: number; pricePerSeat: number;
    preferences: Record<string, boolean>;
    vehicleId?: string;
    // Whichever alternative the driver picked on RouteOptionsScreen —
    // omitted entirely falls back to today's straight-line behavior
    // server-side (see backend rides.routes.js).
    routePolyline?: string;
    routeStops?: { lat: number; lng: number; placeName: string; distanceKm: number; durationMinutes: number }[];
    routeDistanceKm?: number;
    routeDurationMinutes?: number;
  }) => request("/api/rides", { method: "POST", body: JSON.stringify(payload) }),

  getRouteOptions: (sourceLat: number, sourceLng: number, sourceAddress: string, destLat: number, destLng: number, destAddress: string) =>
    request("/api/rides/route-options", {
      method: "POST",
      body: JSON.stringify({ sourceLat, sourceLng, sourceAddress, destLat, destLng, destAddress }),
    }),

  searchRides: (params: { sourceLat: number; sourceLng: number; destLat?: number; destLng?: number; date: string; seats: number; startTime?: string; endTime?: string }) =>
    request(
      `/api/rides/search?sourceLat=${params.sourceLat}&sourceLng=${params.sourceLng}&date=${params.date}&seats=${params.seats}` +
      (params.destLat != null ? `&destLat=${params.destLat}` : "") +
      (params.destLng != null ? `&destLng=${params.destLng}` : "") +
      (params.startTime ? `&startTime=${params.startTime}` : "") +
      (params.endTime ? `&endTime=${params.endTime}` : "")
    ),

  getRideBookings: (rideId: string) => request(`/api/rides/${rideId}/bookings`),

  // pickup/drop are optional — when given, the response's
  // segmentPricePerSeat reflects what THIS passenger actually owes for
  // their own matched stretch of the route, not the ride's full price
  // (see rides.routes.js GET /:id/details). Omitting them (or a ride
  // with no stored route at all) just returns the full ride price, same
  // as before this existed.
  getRideDetails: (rideId: string, pickup?: { lat: number; lng: number }, drop?: { lat: number; lng: number }) =>
    request(
      `/api/rides/${rideId}/details` +
      (pickup ? `?pickupLat=${pickup.lat}&pickupLng=${pickup.lng}` : "") +
      (pickup && drop ? `&dropLat=${drop.lat}&dropLng=${drop.lng}` : "")
    ),

  createBooking: (payload: {
    rideId: string;
    seatsBooked: number;
    pickupLat: number;
    pickupLng: number;
    pickupAddress: string;
    isCustomPickup?: boolean;
    dropLat?: number;
    dropLng?: number;
    dropAddress?: string;
    isCustomDrop?: boolean;
  }) => request("/api/bookings", { method: "POST", body: JSON.stringify(payload) }),

  acceptBooking: (bookingId: string) =>
    request(`/api/bookings/${bookingId}/accept`, { method: "PUT" }),

  rejectBooking: (bookingId: string) =>
    request(`/api/bookings/${bookingId}/reject`, { method: "PUT" }),

  cancelBooking: (bookingId: string) =>
    request(`/api/bookings/${bookingId}/cancel`, { method: "PUT" }),

  driverCancelBooking: (bookingId: string) =>
    request(`/api/bookings/${bookingId}/driver-cancel`, { method: "PUT" }),

  startTrip: (bookingId: string) =>
    request(`/api/trips/${bookingId}/start`, { method: "POST" }),

  getTripOtp: (bookingId: string) =>
    // In a real build this reads the OTP the passenger's own booking record
    // holds server-side (never transmitted over SMS) — stubbed as a GET
    // here; wire to whatever the backend exposes for this read.
    request(`/api/trips/${bookingId}/otp`),

  // `code` can be either the 4-digit OTP the passenger read aloud, or the
  // passenger's Booking ID — either is enough to start the trip.
  verifyTripOtp: (bookingId: string, code: string) =>
    request(`/api/trips/${bookingId}/verify-otp`, { method: "POST", body: JSON.stringify({ code }) }),

  pingLocation: (bookingId: string, lat: number, lng: number) =>
    request(`/api/trips/${bookingId}/location`, { method: "PUT", body: JSON.stringify({ lat, lng }) }),

  trackTrip: (bookingId: string) => request(`/api/trips/${bookingId}/track`),

  // Driver-only: every passenger currently relevant to this ride and
  // what each of them needs next — see trips.routes.js GET
  // /ride/:rideId/manifest. A ride with only ever one passenger at a
  // time still returns exactly one stop.
  getTripManifest: (rideId: string) => request(`/api/trips/ride/${rideId}/manifest`),

  // Either party can close out a ride that's been abandoned/stopped
  // mid-way. No refund/strike logic — just closes it so the passenger
  // can search and rebook fresh.
  stopTrip: (bookingId: string) =>
    request(`/api/trips/${bookingId}/stop`, { method: "POST" }),

  completeTrip: (bookingId: string) =>
    request(`/api/trips/${bookingId}/complete`, { method: "POST" }),

  // Driver's own bookkeeping: confirms the remaining fare was collected
  // directly from the passenger (cash/UPI) — no payment processing here.
  collectCash: (bookingId: string) =>
    request(`/api/trips/${bookingId}/collect-cash`, { method: "PUT" }),

  triggerSos: (bookingId: string, payload: { lat: number; lng: number }) =>
    request(`/api/trips/${bookingId}/sos`, { method: "POST", body: JSON.stringify(payload) }),

  chargeBooking: (bookingId: string) =>
    request(`/api/payments/${bookingId}/charge`, { method: "POST" }),

  // Distinct from chargeBooking — the backend route this hits only
  // accepts a booking already sitting in PAYMENT_PENDING (a previous
  // charge attempt that actually failed), as opposed to charging a
  // booking for the first time from AWAITING_PAYMENT.
  retryPayment: (bookingId: string) =>
    request(`/api/payments/${bookingId}/retry`, { method: "POST" }),

  // Dev-only — stands in for a real Razorpay Checkout + webhook round
  // trip so the booking flow can be tested end-to-end in Expo Go/web,
  // where the native react-native-razorpay module isn't available. The
  // backend 404s this outside NODE_ENV=development.
  mockConfirmPayment: (bookingId: string) =>
    request(`/api/payments/${bookingId}/mock-confirm`, { method: "POST" }),

  getPaymentStatus: (bookingId: string) =>
    request(`/api/payments/${bookingId}/status`),

  getPaymentHistory: () => request("/api/payments/my-history"),

  getRefundStatus: (refundId: string) => request(`/api/payments/refunds/${refundId}/status`),

  placesAutocomplete: (input: string, sessionToken: string) =>
    request(`/api/places/autocomplete?input=${encodeURIComponent(input)}&sessionToken=${sessionToken}`),

  placesDetails: (placeId: string, sessionToken: string) =>
    request(`/api/places/details?placeId=${placeId}&sessionToken=${sessionToken}`),

  reverseGeocode: (lat: number, lng: number) =>
    request(`/api/geocode/reverse?lat=${lat}&lng=${lng}`),

  // "Top searches" for LocationSearchScreen — the most frequently
  // published-to/from addresses across all rides (see rides.routes.js).
  getPopularLocations: () => request("/api/rides/popular-locations"),

  // "Popular routes" for Home — the most-published source→destination
  // pairs, tap one to jump straight into search with both ends filled.
  getPopularRoutes: () => request("/api/rides/popular-routes"),

  getCurrentLocation: async () => {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      ({ status } = await Location.requestForegroundPermissionsAsync());
    }
    if (status !== "granted") {
      throw new Error("Location permission denied. Enable it in Settings to use your current location.");
    }

    const position = await Location.getCurrentPositionAsync({});
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    let address = "Current location";
    try {
      const geo = await api.reverseGeocode(lat, lng);
      address = geo.address;
    } catch {
      // Reverse geocoding is best-effort — the coordinates themselves are
      // still valid and usable even if we can't label them.
    }

    return { lat, lng, address };
  },

  getEmergencyContacts: () => request("/api/emergency-contacts"),

  addEmergencyContact: (payload: { name: string; phone: string; relation?: string; isPrimary?: boolean }) =>
    request("/api/emergency-contacts", { method: "POST", body: JSON.stringify(payload) }),

  deleteEmergencyContact: (id: string) =>
    request(`/api/emergency-contacts/${id}`, { method: "DELETE" }),

  getChatMessages: (bookingId: string) => request(`/api/chats/${bookingId}/messages`),

  markChatRead: (bookingId: string) => request(`/api/chats/${bookingId}/read`, { method: "PUT" }),

  getChatImageUploadUrl: (bookingId: string) =>
    request(`/api/chats/${bookingId}/image-upload-url`, { method: "POST" }),

  // Bridges a masked call between driver and passenger — see
  // calls.routes.js. In dev (CALL_PROXY_ENABLED=false) this returns a
  // mock proxy number instead of placing a real call.
  initiateCall: (bookingId: string, calleeRole: "DRIVER" | "PASSENGER") =>
    request("/api/calls/initiate", { method: "POST", body: JSON.stringify({ bookingId, calleeRole }) }),

  getNotifications: () => request("/api/notifications"),

  markNotificationRead: (id: string) =>
    request(`/api/notifications/${id}/read`, { method: "PUT" }),

  registerDevice: (fcmToken: string | null) =>
    request("/api/notifications/register-device", { method: "POST", body: JSON.stringify({ fcmToken }) }),

  submitReview: (payload: { bookingId: string; toUserId: string; rating: number; comment?: string }) =>
    request("/api/reviews", { method: "POST", body: JSON.stringify(payload) }),

  getReviewsForUser: (userId: string) => request(`/api/reviews/user/${userId}`),

  getMyBookings: () => request("/api/bookings/my"),

  getBookingDetail: (bookingId: string) => request(`/api/bookings/${bookingId}`),

  // Returns { bookingId, role } if the caller has a trip in progress
  // right now, or null. Used on launch to resume into live tracking
  // after a crash/reinstall instead of losing track of an active trip.
  getActiveTrip: () => request("/api/bookings/active-trip"),

  getDriverActiveBookings: () => request("/api/bookings/driver-active"),

  getDriverPendingRequests: () => request("/api/bookings/driver-pending"),

  getMyRides: () => request("/api/rides/my"),

  updateRide: (rideId: string, payload: Record<string, any>) =>
    request(`/api/rides/${rideId}`, { method: "PUT", body: JSON.stringify(payload) }),

  deleteRide: (rideId: string) => request(`/api/rides/${rideId}`, { method: "DELETE" }),

  getEarnings: () => request("/api/rides/earnings"),

  getVehicles: () => request("/api/vehicles"),

  updateVehicle: (id: string, payload: Record<string, string | number>) =>
    request(`/api/vehicles/${id}`, { method: "PUT", body: JSON.stringify(payload) }),

  deleteVehicle: (id: string) => request(`/api/vehicles/${id}`, { method: "DELETE" }),

  getPublicProfile: (userId: string) => request(`/api/users/${userId}/public`),

  getMyProfile: () => request("/api/users/me"),

  getDocumentUploadUrl: (docType: string) =>
    request("/api/documents/upload-url", { method: "POST", body: JSON.stringify({ docType }) }),
};

export async function setAuthToken(token: string) {
  await AsyncStorage.setItem("authToken", token);
}

export async function logout() {
  // Best-effort — deregister the push token server-side so a stale
  // token doesn't linger after the user signs out on this device.
  try {
    await api.registerDevice(null);
  } catch {
    // Ignore — logging out should never get blocked by a network call.
  }
  // Both call sites (SettingsScreens, SideMenu) already call
  // Analytics.logout() right after this — clearing the error-tracking
  // user here, once, means neither has to remember to also do it, and a
  // crash after logout (e.g. on the PhoneEntry screen it lands back on)
  // doesn't get misattributed to whoever was just signed out.
  setErrorTrackingUser(null);
  await AsyncStorage.removeItem("authToken");
  // Tells AppSocketBridge to drop the live connection — without this a
  // stale, still-authenticated socket could sit open after sign-out
  // until the app happened to background/foreground again.
  appEvents.emit("auth:logout");
}
