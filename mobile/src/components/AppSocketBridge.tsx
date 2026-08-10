import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { getSocket, disconnectSocket } from "../lib/socket";
import { api } from "../lib/api";
import { appEvents } from "../lib/appEvents";
import { navigationRef } from "../lib/navigationRef";
import { resolveNotificationTarget } from "../lib/notificationTargets";

// Tapping an OS push notification used to just open the app to wherever
// it happened to be, ignoring what the notification was actually about
// — same underlying map NotificationsScreen's in-app list already uses
// (resolveNotificationTarget), just fed from the FCM data payload
// instead of a Notification row. Needs the current role for NEW_MESSAGE
// (see resolveNotificationTarget) — fetched fresh on tap rather than
// tracked globally, since a tap is rare enough that one extra request
// isn't worth keeping profile state alive app-wide for.
function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as { type?: string; bookingId?: string } | undefined;
  if (!data?.type) return;
  api.getMyProfile().then((profile) => {
    const target = resolveNotificationTarget(data.type!, data.bookingId || null, profile.role);
    if (target && navigationRef.isReady()) {
      (navigationRef as any).navigate(target.screen, target.params);
    }
  }).catch(() => {});
}

// Mounted once at the app root (see App.tsx) — keeps one live socket
// connection open for as long as the app is foregrounded and signed
// in, independent of which screen happens to be on top. Previously the
// socket only ever connected while ChatDetailScreen itself was open,
// so nothing else in the app (a driver starting the trip, a message
// arriving while sitting on Home) could react to a live event at all;
// it silently depended entirely on push notifications, and just as
// silently did nothing when push wasn't configured.
export function AppSocketBridge() {
  useEffect(() => {
    async function connect() {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) return;
      const socket = await getSocket();

      // Reusing the same cached connected socket on every call (foreground,
      // login) means re-registering here would stack duplicate handlers —
      // .off() first keeps this idempotent no matter how many times connect()
      // runs across the app's lifetime.
      socket.off("trip:started");
      socket.on("trip:started", ({ bookingId }: { bookingId: string }) => {
        if (navigationRef.isReady()) {
          (navigationRef as any).navigate("TripOtp", { bookingId });
        }
      });

      socket.off("chat:new");
      socket.on("chat:new", () => {
        appEvents.emit("chat:new");
      });
    }

    connect();

    // Covers both cases setup-on-mount alone misses: the app was
    // backgrounded and the socket dropped (reconnect on return), and a
    // fresh login/logout happening after this component already
    // mounted with no token yet.
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") connect();
    });
    const loginSub = appEvents.on("auth:login", connect);
    const logoutSub = appEvents.on("auth:logout", () => disconnectSocket());

    // expo-notifications' response APIs (last-response, the response
    // listener) throw UnavailabilityError on web — this app's web
    // build doesn't get native push at all, so there's no notification
    // tap to ever handle there in the first place.
    let notificationSub: { remove: () => void } | undefined;
    if (Platform.OS !== "web") {
      // Cold start: the app wasn't running at all and got launched BY
      // tapping a notification — the response listener below is
      // registered too late to catch that one, so it has to be read
      // back separately. Cleared right after so it doesn't re-fire the
      // same navigation on every later app-state change.
      const lastResponse = Notifications.getLastNotificationResponse();
      if (lastResponse) {
        handleNotificationResponse(lastResponse);
        Notifications.clearLastNotificationResponse();
      }
      notificationSub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    }

    return () => {
      appStateSub.remove();
      loginSub();
      logoutSub();
      notificationSub?.remove();
    };
  }, []);

  return null;
}
