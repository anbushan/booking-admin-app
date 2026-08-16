import * as QuickActions from "expo-quick-actions";
import type { Action } from "expo-quick-actions";
import { Platform } from "react-native";

// OS-level "long-press the app icon" shortcuts — the native-launcher
// equivalent of the in-app QuickActionsGrid on Home, for the one or two
// things a driver/passenger reaches for constantly. Only ever set once
// the role is known (there's nothing role-appropriate to offer before
// login), and cleared on logout so a signed-out device doesn't offer a
// shortcut into a screen that'll just bounce back to login anyway.
//
// Same "which screen does this ID actually mean" shape as
// lib/notificationTargets.ts's resolveNotificationTarget — kept as its
// own small map for the same reason: one shared, obvious place to look
// up "what does tapping this thing do" regardless of whether it came
// from a push notification or (here) a home-screen shortcut.
export function resolveQuickActionTarget(id: string): { screen: string; params?: Record<string, any> } | null {
  if (id === "offer-ride") return { screen: "OfferRide" };
  if (id === "booking-requests") return { screen: "BookingRequests" };
  if (id === "search-ride") return { screen: "Home" };
  if (id === "my-bookings") return { screen: "History", params: { role: "PASSENGER" } };
  return null;
}

// iOS built-in SF Symbol names need no bundled asset. Android has no
// equivalent built-in icon set — a custom icon there needs a drawable
// resource this app doesn't have yet, so Android shortcuts fall back to
// the app's own icon (icon omitted) rather than pointing at a resource
// name that doesn't exist.
function iosIcon(name: Action["icon"]): Action["icon"] {
  return Platform.OS === "ios" ? name : undefined;
}

// `t` is passed in rather than called via the useTranslation() hook —
// this isn't a component, and the one caller that needs real titles
// (HomeScreen, on profile load) already has it. The other caller
// (lib/api.ts's logout(), clearing shortcuts with role=null) never
// touches `t` at all, so it's optional rather than forcing a
// translator through a plain data-layer function that has no natural
// access to one. expo-quick-actions has no web implementation (there's
// no OS launcher to attach a shortcut to in a browser tab); the
// Platform check up front avoids even attempting it, matching how
// every other native-only feature in this app gates on Platform.OS
// first rather than relying on a library to silently degrade.
export async function setRoleQuickActions(role: "DRIVER" | "PASSENGER" | null, t: (key: string) => string = (k) => k) {
  if (Platform.OS === "web") return;
  try {
    if (role === "DRIVER") {
      await QuickActions.setItems([
        { id: "offer-ride", title: t("home.offerARide"), icon: iosIcon("add") },
        { id: "booking-requests", title: t("home.bookingRequests"), icon: iosIcon("mail") },
      ]);
    } else if (role === "PASSENGER") {
      await QuickActions.setItems([
        { id: "search-ride", title: t("home.searchRides"), icon: iosIcon("search") },
        { id: "my-bookings", title: t("navTabs.bookings"), icon: iosIcon("task") },
      ]);
    } else {
      await QuickActions.setItems([]);
    }
  } catch {
    // Best-effort — an unsupported OS version or a build that predates
    // this dependency being compiled in shouldn't take anything else
    // down with it, the same reasoning LocationSearchScreen.tsx's
    // guarded require() for expo-speech-recognition already applies.
  }
}
