import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

// Point this at your local backend during development (see backend/.env.example).
// Use your machine's LAN IP, not localhost, when testing on a physical device.
const API_BASE_URL = "http://192.168.1.3:4000";

async function request(path: string, options: RequestInit = {}) {
  const token = await AsyncStorage.getItem("authToken");

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  sendOtp: (phone: string) =>
    request("/api/auth/send-otp", { method: "POST", body: JSON.stringify({ phone }) }),

  verifyOtp: (phone: string, otp: string) =>
    request("/api/auth/verify-otp", { method: "POST", body: JSON.stringify({ phone, otp }) }),

  updateProfile: (payload: { name: string; email?: string; role: "PASSENGER" | "DRIVER" }) =>
    request("/api/users/me", { method: "PUT", body: JSON.stringify(payload) }),

  addVehicle: (payload: { make: string; model: string; regNumber: string; color?: string }) =>
    request("/api/vehicles", { method: "POST", body: JSON.stringify(payload) }),

  createRide: (payload: {
    sourceLat: number; sourceLng: number; sourceAddress: string;
    destLat: number; destLng: number; destAddress: string;
    travelDate: string; seatsAvailable: number; pricePerSeat: number;
    preferences: Record<string, boolean>;
  }) => request("/api/rides", { method: "POST", body: JSON.stringify(payload) }),

  searchRides: (params: { sourceLat: number; sourceLng: number; date: string; seats: number }) =>
    request(
      `/api/rides/search?sourceLat=${params.sourceLat}&sourceLng=${params.sourceLng}&date=${params.date}&seats=${params.seats}`
    ),

  getRideBookings: (rideId: string) => request(`/api/rides/${rideId}/bookings`),

  getRideDetails: (rideId: string) => request(`/api/rides/${rideId}/details`),

  createBooking: (payload: {
    rideId: string;
    seatsBooked: number;
    pickupLat: number;
    pickupLng: number;
    pickupAddress: string;
    isCustomPickup?: boolean;
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

  getDriverActiveBookings: () => request("/api/bookings/driver-active"),

  getDriverPendingRequests: () => request("/api/bookings/driver-pending"),

  getMyRides: () => request("/api/rides/my"),

  updateRide: (rideId: string, payload: Record<string, any>) =>
    request(`/api/rides/${rideId}`, { method: "PUT", body: JSON.stringify(payload) }),

  deleteRide: (rideId: string) => request(`/api/rides/${rideId}`, { method: "DELETE" }),

  getEarnings: () => request("/api/rides/earnings"),

  getVehicles: () => request("/api/vehicles"),

  updateVehicle: (id: string, payload: Record<string, string>) =>
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
  await AsyncStorage.removeItem("authToken");
}
