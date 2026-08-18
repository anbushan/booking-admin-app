// Shared between OfferRideForm.tsx (where a driver sets these) and
// components/RidePreferences.tsx (the read-only passenger-facing
// display in SearchResultsScreen/BookingConfirmScreen) — one definition
// of what each key means and how it's labeled, so the two can't quietly
// drift apart. `inverted: true` means the flag's stored/default value
// is the *opposite* of what reads as the positive, highlighted state —
// smoking defaults to false, and "No smoking" is the chip that lights
// up when it's false, not when it's true.
export const PREFERENCE_OPTIONS = [
  { key: "music", labelKey: "offerRide.musicOk" },
  { key: "pets", labelKey: "offerRide.petsOk" },
  { key: "smoking", labelKey: "offerRide.noSmoking", inverted: true },
];
