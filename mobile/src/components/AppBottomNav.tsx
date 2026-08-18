import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNavBar } from "./BottomNavBar";
import { SkeletonBlock } from "./Skeleton";
import { colors, spacing } from "../theme/theme";
import { api } from "../lib/api";
import { appEvents } from "../lib/appEvents";
import { syncBadgeCount } from "../lib/pushNotifications";
import { useTranslation } from "../lib/i18n/I18nContext";

// The persistent chrome for the app's 4 real tabs (Home, Requests/My
// requests, My rides/Bookings, Menu) — the "Menu" tab pushes to
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
  // Offering a ride now happens inline on Home itself (no more separate
  // OfferRide screen to give its own tab to) — "My rides" takes that
  // slot instead, the driver-side mirror of the passenger's "Bookings"
  // tab below, so both roles end up with the same shape: Home /
  // [pending-action list] / [ride history] / Menu.
  const navTabs = isDriver
    ? [
        { key: "home", label: t("navTabs.home"), icon: "home-outline" as const, iconActive: "home" as const },
        { key: "requests", label: t("navTabs.requests"), icon: "mail-unread-outline" as const, iconActive: "mail-open" as const, badge: pendingRequestCount },
        { key: "myRides", label: t("navTabs.myRides"), icon: "car-outline" as const, iconActive: "car" as const },
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
    else if (key === "requests") navigation.navigate("BookingRequests");
    else if (key === "myRides") navigation.navigate("History", { role: "DRIVER" });
    else if (key === "myRequests") navigation.navigate("MyRequests");
    else if (key === "bookings") navigation.navigate("History", { role: profile?.role });
    else if (key === "menu") navigation.navigate("Account");
  }

  // `profile` is null for one real beat in two situations: the very
  // first render of any screen that mounts before its own getMyProfile()
  // resolves, and — the one that actually got reported — right after a
  // role switch, where SwitchRoleScreen's navigation.reset() to Home
  // throws away the whole stack and starts over from a blank slate.
  // Computing navTabs off `isDriver` (silently false while profile is
  // null) meant this bar always guessed "passenger" for that beat, then
  // visibly swapped to the driver set the instant the real profile
  // landed — that swap was the flicker. A neutral shimmer placeholder
  // for the unknown beat means the real tab set only ever renders once,
  // already correct.
  if (!profile?.role) {
    return <BottomNavSkeleton />;
  }

  return <BottomNavBar tabs={navTabs} active={active} onTabPress={handleTabPress} />;
}

function BottomNavSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[skeletonStyles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={skeletonStyles.tab}>
          <SkeletonBlock style={skeletonStyles.icon} />
          <SkeletonBlock style={skeletonStyles.label} />
        </View>
      ))}
    </View>
  );
}

// Mirrors BottomNavBar's own .bar/.tab dimensions exactly (padding,
// height) so there's no layout jump the instant the real bar swaps in —
// only the tab contents differ, not the bar's footprint.
const skeletonStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 2 },
  icon: { width: 22, height: 22, borderRadius: 11 },
  label: { width: 32, height: 8, borderRadius: 4 },
});
