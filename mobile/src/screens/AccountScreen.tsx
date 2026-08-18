import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api, logout } from "../lib/api";
import { Analytics } from "../lib/analytics";
import Avatar from "../components/Avatar";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";
import { SkeletonBlock } from "../components/Skeleton";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

// The "Menu" bottom-nav tab's destination — a full page (Rapido/Zomato
// style: their equivalent tab is a real screen, not a slide-out drawer),
// replacing the old SideMenu modal. Same content that modal had, just as
// a normal pushed/tab screen: profile block up top, then every row the
// bottom nav's other 3 tabs don't already cover.
export default function AccountScreen({ navigation }: any) {
  useScreenView("AccountScreen");
  const { t } = useTranslation();
  const [profile, setProfile] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const isDriver = profile?.role === "DRIVER";
  const otherRoleHasProfile = isDriver ? profile?.isPassenger : profile?.isDriver;

  useFocusEffect(
    useCallback(() => {
      api.getMyProfile().then(setProfile).catch(() => {});
      api.getNotifications().then((list: any[]) => setUnreadCount(list.filter((n) => !n.read).length)).catch(() => {});
    }, [])
  );

  function handleLogout() {
    showAlert(t("sideMenu.logOut"), t("sideMenu.logOutConfirm"), [
      { text: t("sideMenu.cancel"), style: "cancel" },
      {
        text: t("sideMenu.logOut"),
        style: "destructive",
        onPress: async () => {
          await logout();
          Analytics.logout();
          navigation.reset({ index: 0, routes: [{ name: "PhoneEntry" }] });
        },
      },
    ]);
  }

  // `profile` is null for one real beat — first load, or right after a
  // role switch (SwitchRoleScreen resets the whole stack to a fresh
  // Home/AccountScreen with no profile carried over). Rendering the
  // real content immediately off that null meant `isDriver` defaulted
  // false, so the driver-only section below was simply absent — then
  // popped in the instant the real profile arrived if the role turned
  // out to be DRIVER. A shimmer placeholder for that one beat means
  // this page only ever renders once, already showing the right rows.
  if (!profile) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        {/* flex:1 here matters, not just cosmetic — without it this View
            only takes its own content's height instead of filling the
            screen the way the loaded state's ScrollView does, so
            AppBottomNav (its sibling below) would sit wherever the
            content happens to end instead of pinned to the bottom, then
            visibly jump down the moment the real, full-height content
            swaps in. */}
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg }}>
          <View style={styles.profileCard}>
            <SkeletonBlock style={{ width: 52, height: 52, borderRadius: 26 }} />
            <View style={{ flex: 1, marginLeft: spacing.md, gap: spacing.xs }}>
              <SkeletonBlock style={{ width: "50%", height: 15, borderRadius: 4 }} />
              <SkeletonBlock style={{ width: "30%", height: 12, borderRadius: 4 }} />
            </View>
          </View>
          <View style={[styles.list, { paddingVertical: spacing.sm, gap: spacing.md }]}>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} style={{ height: 14, borderRadius: 4 }} />
            ))}
          </View>
        </View>
        <AppBottomNav navigation={navigation} profile={profile} active="menu" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
        <Pressable style={styles.profileCard} onPress={() => navigation.navigate("Profile")}>
          <Avatar uri={profile?.photoViewUrl} name={profile?.name} size={52} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.name} numberOfLines={1}>{profile?.name || t("sideMenu.yourProfile")}</Text>
            <View style={styles.roleBadge}>
              <Ionicons name={isDriver ? "car-sport" : "person"} size={11} color={colors.accentText} />
              <Text style={styles.role}>{isDriver ? t("register.driver") : t("register.passenger")}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {/* "Home" isn't listed here — it's always one of the other bottom
            nav tabs, so a duplicate entry to the exact same screen just
            adds noise. Same reasoning leaves "Offer a ride"/"Booking
            requests" (driver) and "My requests" (passenger) off this
            page — each already has its own tab. No standalone "Chat"
            entry either — chat only exists for a booking that's
            currently CONFIRMED, reached from that booking's own card.

            Payment history/Your ratings/Emergency contacts apply to
            either role (both sides get rated, both can carry booking
            payment history, either can be alone on a trip) — one shared
            list rather than duplicating them per role section below.
            This is now their one home: pulled out of Settings and
            ProfileScreen, which listed the same two/three rows again. */}
        <View style={styles.list}>
          <Row icon="notifications-outline" label={t("sideMenu.notifications")} onPress={() => navigation.navigate("Notifications")} badge={unreadCount} />
          <Row icon="receipt-outline" label={t("settings.paymentHistory")} onPress={() => navigation.navigate("PaymentHistory")} />
          <Row icon="star-outline" label={t("settings.yourRatings")} onPress={() => navigation.navigate("RatingsReceived")} />
          <Row icon="shield-checkmark-outline" label={t("settings.emergencyContacts")} onPress={() => navigation.navigate("EmergencyContacts")} />
        </View>

        {/* My bookings/Payment queue/Start trip now/My vehicles used to
            live here too, but every one of them is already a tile on
            Home's driver quick-actions grid — this was a second,
            further-to-reach copy of the same destinations. Earnings and
            Recurring rides are the two exceptions: Earnings had its
            Home tile repurposed for Messages, and Recurring rides never
            had a Home tile of its own to begin with — both still need
            a home, and this is it. */}
        {isDriver && (
          <>
            <Text style={styles.sectionLabel}>{t("sideMenu.driverSection")}</Text>
            <View style={styles.list}>
              {/* Moved here from Home's quick-actions grid, which now
                  points that tile at Messages instead. */}
              <Row icon="wallet-outline" label={t("home.earnings")} onPress={() => navigation.navigate("Earnings")} />
              <Row icon="repeat-outline" label={t("sideMenu.recurringRides")} onPress={() => navigation.navigate("ManageRecurringRides")} />
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>{t("sideMenu.accountSection")}</Text>
        <View style={styles.list}>
          {/* Same phone number can be both a driver and a passenger —
              this is the one entry point to switch which one is active,
              or set up the other for the first time if it hasn't been
              used before (labeled distinctly so it's clear it's new). */}
          <Row
            icon="swap-horizontal-outline"
            label={isDriver ? (otherRoleHasProfile ? t("sideMenu.switchToPassenger") : t("sideMenu.alsoRideAsPassenger")) : (otherRoleHasProfile ? t("sideMenu.switchToDriver") : t("sideMenu.alsoDriveWithNanbaGO"))}
            onPress={() => navigation.navigate("SwitchRole")}
          />
          <Row icon="gift-outline" label={t("sideMenu.rewards")} onPress={() => navigation.navigate("Rewards")} />
          <Row icon="settings-outline" label={t("sideMenu.settings")} onPress={() => navigation.navigate("Settings")} />
        </View>

        <Pressable style={styles.logoutRow} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={17} color={colors.danger} />
          <Text style={styles.logoutText}>{t("sideMenu.logOut")}</Text>
        </Pressable>

        {/* Deliberately not a Row in the list above — that put it right
            next to Rewards/Settings, both regular navigable rows someone
            scrolling and tapping quickly could hit by accident. A small,
            plain text link set apart below Logout (same treatment it had
            on the old SettingsScreen) still gets there but doesn't read
            as "just another menu item" the way a full icon+chevron row
            did. */}
        <Pressable style={styles.deleteAccountLink} onPress={() => navigation.navigate("DeleteAccount")}>
          <Text style={styles.deleteAccountLinkText}>{t("settings.deleteAccount")}</Text>
        </Pressable>
      </ScrollView>
      <AppBottomNav navigation={navigation} profile={profile} active="menu" />
    </SafeAreaView>
  );
}

function Row({ icon, label, onPress, badge }: { icon: string; label: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon as any} size={17} color={colors.accentText} />
      </View>
      <Text style={styles.rowText}>{label}</Text>
      {!!badge && (
        <View style={styles.rowBadge}>
          <Text style={styles.rowBadgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  name: { ...typography.title, fontSize: 16 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  role: { ...typography.small, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  sectionLabel: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  list: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 11 },
  rowIconWrap: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  rowText: { ...typography.body, color: colors.textPrimary, flex: 1 },
  rowBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", fontFamily: FONT.bold },
  logoutRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  logoutText: { ...typography.body, color: colors.danger, fontWeight: "700", fontFamily: FONT.bold },
  deleteAccountLink: { alignItems: "center", justifyContent: "center", padding: spacing.sm, marginTop: spacing.md },
  deleteAccountLinkText: { ...typography.small, color: colors.textMuted, textDecorationLine: "underline" },
});
