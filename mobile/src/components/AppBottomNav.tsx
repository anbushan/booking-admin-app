import React, { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { BottomNavBar } from "./BottomNavBar";
import { api } from "../lib/api";
import { appEvents } from "../lib/appEvents";
import { syncBadgeCount } from "../lib/pushNotifications";
import { useTranslation } from "../lib/i18n/I18nContext";

// The persistent chrome for the app's 4 real tabs (Home, Offer/My
// requests, Requests/Bookings, Menu) — the "Menu" tab pushes to
// AccountScreen (Rapido/Zomato style: a real page, not a slide-out
// drawer), same as any other tab. Self-contained: it fetches its own
// badge counts so every screen that renders it only needs `navigation`,
// `profile`, and which tab (if any) to highlight.
type Props = {
  navigation: any;
  profile: { id?: string; name?: string; role?: string; isDriver?: boolean; isPassenger?: boolean } | null;
  active?: string;
};

export function AppBottomNav({ navigation, profile, active = "" }: Props) {
  const { t } = useTranslation();
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [myRequestsCount, setMyRequestsCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const isDriver = profile?.role === "DRIVER";

  const refresh = useCallback(() => {
    if (!profile?.role) return;
    if (isDriver) {
      api.getDriverPendingRequests().then((list: any[]) => setPendingRequestCount(list.length)).catch(() => {});
    } else {
      api.getMyBookings()
        .then((list: any[]) => setMyRequestsCount(list.filter((b) => ["BOOKED", "AWAITING_PAYMENT", "PAYMENT_PENDING"].includes(b.status)).length))
        .catch(() => {});
    }
    api.getNotifications().then((list: any[]) => {
      const count = list.filter((n) => !n.read).length;
      setUnreadCount(count);
      // Keeps the OS app-icon badge (the numbered dot on the home
      // screen, same as WhatsApp/LinkedIn) honestly in sync — this is
      // the one place that count is recomputed on every hub-screen
      // focus, so it's the natural place to also push it to the icon.
      syncBadgeCount(count);
    }).catch(() => {});
  }, [profile?.role, isDriver]);

  // Refetch every time a hub screen regains focus, not just once on
  // mount — otherwise a badge stays stuck at whatever it was when the
  // app launched even after you've gone and cleared it (accepted the
  // pending request, read the notification, etc.), which is exactly
  // what "reset to 0 after viewing" needs.
  useFocusEffect(refresh);

  // On top of that, a live "chat:new" (see AppSocketBridge) refreshes
  // immediately even without leaving the current screen — previously a
  // message arriving while sitting on Home just sat unreflected in the
  // badge until the next navigation happened to trigger a refetch.
  useEffect(() => appEvents.on("chat:new", refresh), [refresh]);

  // The "Menu" tab itself carries no badge — a number on the menu
  // button alone doesn't say what's waiting inside, which is exactly
  // what read as confusing. Each count instead shows on the specific
  // row it belongs to: pending requests / my requests here on the
  // bottom nav (they have their own tab), and unread notifications on
  // the Notifications row on the Menu page itself (AccountScreen).
  const navTabs = isDriver
    ? [
        { key: "home", label: t("navTabs.home"), icon: "home-outline" as const, iconActive: "home" as const },
        { key: "offerRide", label: t("navTabs.offerRide"), icon: "add-circle-outline" as const, iconActive: "add-circle" as const },
        { key: "requests", label: t("navTabs.requests"), icon: "mail-unread-outline" as const, iconActive: "mail-open" as const, badge: pendingRequestCount },
        { key: "menu", label: t("navTabs.menu"), icon: "grid-outline" as const, iconActive: "grid" as const },
      ]
    : [
        { key: "home", label: t("navTabs.home"), icon: "home-outline" as const, iconActive: "home" as const },
        { key: "myRequests", label: t("navTabs.myRequests"), icon: "list-outline" as const, iconActive: "list" as const, badge: myRequestsCount },
        { key: "bookings", label: t("navTabs.bookings"), icon: "receipt-outline" as const, iconActive: "receipt" as const },
        { key: "menu", label: t("navTabs.menu"), icon: "grid-outline" as const, iconActive: "grid" as const },
      ];

  function handleTabPress(key: string) {
    if (key === "home") navigation.navigate("Home");
    else if (key === "offerRide") navigation.navigate("OfferRide");
    else if (key === "requests") navigation.navigate("BookingRequests");
    else if (key === "myRequests") navigation.navigate("MyRequests");
    else if (key === "bookings") navigation.navigate("History", { role: profile?.role });
    else if (key === "menu") navigation.navigate("Account");
  }

  return <BottomNavBar tabs={navTabs} active={active} onTabPress={handleTabPress} />;
}
