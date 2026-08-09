import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import SideMenu from "./SideMenu";
import { BottomNavBar } from "./BottomNavBar";
import { api } from "../lib/api";

// The persistent chrome for every "hub" screen (Home, My bookings,
// Requests, Notifications, Settings, Profile, Earnings, ...) — screens
// you land on repeatedly and jump between, as opposed to a specific
// task's screens (search results, booking confirm, payment, chat...)
// which still push/pop normally with a back button. Self-contained: it
// fetches its own badge counts and owns its own SideMenu instance, so
// every hub screen only needs `navigation`, `profile`, and which tab
// (if any) to highlight — no per-screen badge-fetching duplication.
type Props = {
  navigation: any;
  profile: { id?: string; name?: string; role?: string } | null;
  active?: string;
};

export function AppBottomNav({ navigation, profile, active = "" }: Props) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [myRequestsCount, setMyRequestsCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [upcomingTripsCount, setUpcomingTripsCount] = useState(0);
  const isDriver = profile?.role === "DRIVER";

  // Refetch every time a hub screen regains focus, not just once on
  // mount — otherwise a badge stays stuck at whatever it was when the
  // app launched even after you've gone and cleared it (accepted the
  // pending request, read the notification, etc.), which is exactly
  // what "reset to 0 after viewing" needs.
  useFocusEffect(
    useCallback(() => {
      if (!profile?.role) return;
      if (isDriver) {
        api.getDriverPendingRequests().then((list: any[]) => setPendingRequestCount(list.length)).catch(() => {});
        // Same filter UpcomingTripsScreen itself uses — the badge counts
        // exactly what you'd see if you tapped through, same as every
        // other badge in this app.
        api.getDriverActiveBookings()
          .then((list: any[]) => setUpcomingTripsCount(list.filter((t) => ["AWAITING_PAYMENT", "CONFIRMED", "IN_PROGRESS"].includes(t.status)).length))
          .catch(() => {});
      } else {
        api.getMyBookings()
          .then((list: any[]) => setMyRequestsCount(list.filter((b) => ["BOOKED", "AWAITING_PAYMENT", "PAYMENT_PENDING"].includes(b.status)).length))
          .catch(() => {});
      }
      api.getNotifications().then((list: any[]) => setUnreadCount(list.filter((n) => !n.read).length)).catch(() => {});
    }, [profile?.role, isDriver])
  );

  // The "Menu" tab itself carries no badge — a number on the menu
  // button alone doesn't say what's waiting inside, which is exactly
  // what read as confusing. Each count instead shows on the specific
  // row it belongs to: pending requests / my requests here on the
  // bottom nav (they have their own tab), and unread notifications on
  // the Notifications row inside the side menu.
  const navTabs = isDriver
    ? [
        { key: "home", label: "Home", icon: "home-outline" as const, iconActive: "home" as const },
        { key: "offerRide", label: "Offer ride", icon: "add-circle-outline" as const, iconActive: "add-circle" as const },
        { key: "requests", label: "Requests", icon: "mail-unread-outline" as const, iconActive: "mail-open" as const, badge: pendingRequestCount },
        { key: "menu", label: "Menu", icon: "grid-outline" as const, iconActive: "grid" as const },
      ]
    : [
        { key: "home", label: "Home", icon: "home-outline" as const, iconActive: "home" as const },
        { key: "myRequests", label: "My requests", icon: "list-outline" as const, iconActive: "list" as const, badge: myRequestsCount },
        { key: "bookings", label: "Bookings", icon: "receipt-outline" as const, iconActive: "receipt" as const },
        { key: "menu", label: "Menu", icon: "grid-outline" as const, iconActive: "grid" as const },
      ];

  function handleTabPress(key: string) {
    if (key === "home") navigation.navigate("Home");
    else if (key === "offerRide") navigation.navigate("OfferRide");
    else if (key === "requests") navigation.navigate("BookingRequests");
    else if (key === "myRequests") navigation.navigate("MyRequests");
    else if (key === "bookings") navigation.navigate("History", { role: profile?.role });
    else if (key === "menu") setMenuVisible(true);
  }

  return (
    <>
      <BottomNavBar tabs={navTabs} active={active} onTabPress={handleTabPress} />
      <SideMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        navigation={navigation}
        profile={profile}
        unreadCount={unreadCount}
        upcomingTripsCount={upcomingTripsCount}
      />
    </>
  );
}
