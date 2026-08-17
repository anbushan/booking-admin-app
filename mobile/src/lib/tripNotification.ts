import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { isExpoGo } from "./pushNotifications";

// A persistent notification bar entry while a trip is IN_PROGRESS,
// showing live ETA/distance — the same idea as Google Maps/Uber keeping
// a running notification during navigation, visible even with the app
// backgrounded or the screen locked (which live tracking now supports
// on Android — see app.json's isAndroidBackgroundLocationEnabled).
//
// A fixed `identifier` is the whole trick here: re-presenting a
// notification with the same identifier UPDATES the existing tray
// entry in place instead of stacking a new one on every position ping,
// the same way a real navigation app's notification content changes
// without producing a new notification each time.
//
// `sticky` (Android-only — see Notifications.types.d.ts) makes it
// un-swipeable, only ever dismissed by dismissTripNotification() below,
// not by the user brushing it away mid-trip. iOS has no equivalent
// concept without a Live Activity (a native Swift API with no config
// plugin in this Expo-managed app), so there it's just a normal,
// content-updating notification — not literally un-dismissable, but
// still shows live progress the same way.
const TRIP_NOTIFICATION_ID = "trip-tracking";

export async function showTripNotification(title: string, body: string) {
  // Expo Go on Android (SDK 53+) rejects effectively every
  // expo-notifications call, not just remote push — this isn't
  // something broken to fix, it's Expo Go's own documented limitation
  // (see pushNotifications.ts's isExpoGo, same guard reused here). The
  // live map itself is unaffected either way; this notification only
  // ever mattered on a real dev/production build to begin with.
  if (isExpoGo) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: TRIP_NOTIFICATION_ID,
      content: {
        title,
        body,
        sticky: Platform.OS === "android",
        autoDismiss: false,
        // Updates roughly every position ping — a sound/vibration on
        // every single one would be noise, not signal. The one moment
        // this is genuinely new information (trip started) is handled
        // by the screen transition itself, not this notification.
        sound: false,
      },
      trigger: null, // present immediately, not scheduled for later
    });
  } catch {
    // Best-effort — a missing notification permission (or a platform
    // that rejects `sticky`) shouldn't interrupt the trip itself, the
    // in-app live map is still the primary source of truth.
  }
}

export async function dismissTripNotification() {
  if (isExpoGo) return;
  await Notifications.dismissNotificationAsync(TRIP_NOTIFICATION_ID).catch(() => {});
}
