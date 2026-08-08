import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

// Persists across logout/login — this is what actually stops the OS
// permission dialog from reappearing. requestPermissionsAsync() is
// normally safe to call repeatedly (the OS itself won't re-prompt once
// the user has made a real choice), but this app calls
// setupPushNotifications() on every login, and a developer/tester who
// logs out and back in repeatedly hits it far more often than a real
// user ever would — surfacing any OS-level quirk (Android in
// particular can be inconsistent about honoring a prior "deny" as
// final) as what reads like being asked "every time". Gating the
// request itself on a flag makes the answer permanent from this app's
// side regardless of platform behavior.
const ASKED_KEY = "pushPermissionRequested";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // shouldShowAlert is deprecated as of SDK 53 in favor of these two —
    // banner is the transient in-app banner, list is the notification
    // center/tray entry. Keep both true to match the old shouldShowAlert
    // behavior of always surfacing the notification.
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Call once at app startup (after login). Registers whatever token is
// available — or explicitly registers null if permission is denied, so
// the backend knows not to attempt push and relies on the in-app
// Notification list as the sole channel (see plan section 11L).
export async function setupPushNotifications(): Promise<{ granted: boolean }> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const alreadyAsked = await AsyncStorage.getItem(ASKED_KEY);
    if (!alreadyAsked) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      await AsyncStorage.setItem(ASKED_KEY, "1");
    }
  }

  if (finalStatus !== "granted") {
    await api.registerDevice(null);
    return { granted: false };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const tokenResponse = await Notifications.getDevicePushTokenAsync();
  // NOTE: getDevicePushTokenAsync returns the raw APNs/FCM token. For a
  // custom dev client with react-native-firebase, prefer messaging()
  // .getToken() instead — both end up calling api.registerDevice with an
  // FCM-compatible token string.
  await api.registerDevice(tokenResponse.data);

  return { granted: true };
}

export async function checkPushPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}
