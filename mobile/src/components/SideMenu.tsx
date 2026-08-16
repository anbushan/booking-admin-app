import React, { useEffect, useRef, useState } from "react";
import { View, Text, Modal, ScrollView, Animated, Easing, Dimensions, StyleSheet } from "react-native";
import { Pressable } from "./Pressable";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { logout } from "../lib/api";
import { Analytics } from "../lib/analytics";
import Avatar from "./Avatar";
import { useTranslation } from "../lib/i18n/I18nContext";

// Home never had any way into the rest of the app — Profile, History,
// Chat, Notifications, and the driver tools were all built and
// registered in the navigator but reachable from nowhere. This is the
// single entry point for all of it, opened from the "Menu" tab in the
// bottom nav.
//
// Opens from the right edge (Rapido/BlaBlaCar style, not a left drawer)
// with a hand-rolled slide — RN's Modal `animationType="slide"` only
// ever slides up from the bottom, so getting a horizontal slide-in
// means keeping the modal mounted through the close animation ourselves
// (`mounted` state) rather than letting `visible` unmount it instantly.

const SCREEN_WIDTH = Dimensions.get("window").width;
const CLOSE_DURATION = 240;

type Props = {
  visible: boolean;
  onClose: () => void;
  navigation: any;
  profile: { id?: string; name?: string; role?: string; isDriver?: boolean; isPassenger?: boolean; photoViewUrl?: string | null } | null;
  unreadCount?: number;
  upcomingTripsCount?: number;
};

export default function SideMenu({ visible, onClose, navigation, profile, unreadCount = 0, upcomingTripsCount = 0 }: Props) {
  const { t } = useTranslation();
  // Two real gaps this closes, not just one: the panel was a plain View
  // with no ScrollView at all, so on a driver account (9 rows —
  // notifications, 5 driver-section rows, 2 account-section rows, sign
  // out) a small enough device could push "Sign out" off-screen
  // entirely, not just overlapped — genuinely unreachable, not a visual
  // nitpick. And like every other Modal in this app, this presents
  // outside the screen's own SafeAreaView, so nothing was padding for
  // the device's bottom inset either.
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const translateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateX.setValue(SCREEN_WIDTH);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: SCREEN_WIDTH, duration: CLOSE_DURATION, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: CLOSE_DURATION, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible]);

  // onClose() and navigation.navigate() used to fire in the same tick —
  // the sidebar's own close animation and the new screen's push
  // transition then both started at once, competing for the same JS/UI
  // thread work (this app runs without New Architecture, for
  // react-native-razorpay compat, so there's no Fabric concurrency to
  // absorb that), which is exactly what read as "not smooth". Letting
  // the close animation actually finish first, then navigating,
  // sequences the two instead of layering them.
  function go(route: string, params?: Record<string, any>) {
    onClose();
    setTimeout(() => navigation.navigate(route, params), CLOSE_DURATION);
  }

  function handleLogout() {
    showAlert(t("sideMenu.logOut"), t("sideMenu.logOutConfirm"), [
      { text: t("sideMenu.cancel"), style: "cancel" },
      {
        text: t("sideMenu.logOut"),
        style: "destructive",
        onPress: async () => {
          await logout();
          Analytics.logout();
          onClose();
          navigation.reset({ index: 0, routes: [{ name: "PhoneEntry" }] });
        },
      },
    ]);
  }

  if (!mounted) return null;

  const isDriver = profile?.role === "DRIVER";
  const otherRoleHasProfile = isDriver ? profile?.isPassenger : profile?.isDriver;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} noFeedback />
        </Animated.View>

        {/* renderToHardwareTextureAndroid — this panel carries a drop
            shadow (elevation: 12) and is animated via transform every
            open/close. Without this, Android has to recompute the
            shadow's compositing on every single frame of the slide
            instead of just moving a pre-rendered layer, which is
            exactly what read as "not closing smoothly" — a well-known
            RN Android cost specifically for elevation + transform
            together, not a bug in the animation's own timing/easing. */}
        {/* panel's own paddingTop was a flat spacing.xl (24px) with no
            regard for the device's actual top safe-area inset — fine on
            a typical phone, but the close button and profile block sat
            underneath the status bar / notch / dynamic island on
            anything with a bigger inset (large-screen tablets included),
            same class of bug the ScrollView's bottom padding below was
            already fixed for. */}
        <Animated.View
          style={[styles.panel, { paddingTop: Math.max(insets.top, spacing.xl), transform: [{ translateX }] }]}
          renderToHardwareTextureAndroid
        >
          {/* position:absolute doesn't follow the panel's own padding —
              it offsets from the panel's outer edge regardless, so this
              needs the same insets.top accounting the padding above
              just got, or it'd still land under the notch/status bar
              on a large-inset device even though the padding fix alone
              already moved everything else (the scrollable content)
              clear of it. */}
          <Pressable
            style={[styles.closeButton, { top: Math.max(insets.top + spacing.xs, spacing.md) }]}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          >
            <Ionicons name="close" size={18} color={colors.textPrimary} />
          </Pressable>

          {/* Everything below the close button now scrolls — was a bare
              View before, so a driver account's longer row list had no
              way to reach "Sign out" at all on a small enough screen,
              not just an overlap. contentContainerStyle's paddingBottom
              is the device inset fix, same reasoning as every other
              Modal-based sheet in this app. */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, spacing.lg) }}>
          <Pressable style={styles.profileBlock} onPress={() => go("Profile")}>
            <View style={{ marginBottom: spacing.sm }}>
              <Avatar uri={profile?.photoViewUrl} name={profile?.name} size={48} />
            </View>
            <Text style={styles.name}>{profile?.name || t("sideMenu.yourProfile")}</Text>
            <View style={styles.roleBadge}>
              <Ionicons name={isDriver ? "car-sport" : "person"} size={11} color={colors.accentText} />
              <Text style={styles.role}>{isDriver ? t("register.driver") : t("register.passenger")}</Text>
            </View>
          </Pressable>

          {/* "Home" isn't listed here — it's always one of the bottom nav
              tabs for both roles, so a duplicate entry to the exact same
              screen just adds noise. Same reasoning removed "Offer a
              ride"/"Booking requests" from the driver section below (both
              already have their own bottom nav tab) and "My requests"
              from the passenger section (ditto) — this menu now only
              lists what the bottom nav *doesn't* already cover.
              No standalone "Chat" entry either — chat only exists for a
              booking that's currently CONFIRMED (paid, pre-trip), so it's
              reached from that booking's own card rather than a generic
              list that would mostly be empty. */}
          <MenuRow icon="notifications-outline" label={t("sideMenu.notifications")} onPress={() => go("Notifications")} badge={unreadCount} />

          {isDriver && (
            <>
              <Text style={styles.sectionLabel}>{t("sideMenu.driverSection")}</Text>
              <MenuRow icon="receipt-outline" label={t("sideMenu.myBookings")} onPress={() => go("History", { role: profile?.role })} />
              <MenuRow icon="hourglass-outline" label={t("sideMenu.paymentQueue")} onPress={() => go("PaymentQueue")} />
              <MenuRow icon="navigate-outline" label={t("home.startTripNow")} onPress={() => go("UpcomingTrips")} badge={upcomingTripsCount} />
              <MenuRow icon="car-sport-outline" label={t("sideMenu.myVehicles")} onPress={() => go("VehicleList")} />
              <MenuRow icon="wallet-outline" label={t("home.earnings")} onPress={() => go("Earnings")} />
              <MenuRow icon="repeat-outline" label={t("sideMenu.recurringRides")} onPress={() => go("ManageRecurringRides")} />
            </>
          )}

          <Text style={styles.sectionLabel}>{t("sideMenu.accountSection")}</Text>
          {/* Same phone number can be both a driver and a passenger —
              this is the one entry point to switch which one is active,
              or set up the other for the first time if it hasn't been
              used before (labeled distinctly so it's clear it's new). */}
          <MenuRow
            icon="swap-horizontal-outline"
            label={isDriver ? (otherRoleHasProfile ? t("sideMenu.switchToPassenger") : t("sideMenu.alsoRideAsPassenger")) : (otherRoleHasProfile ? t("sideMenu.switchToDriver") : t("sideMenu.alsoDriveWithNanbaGO"))}
            onPress={() => go("SwitchRole")}
          />
          <MenuRow icon="settings-outline" label={t("sideMenu.settings")} onPress={() => go("Settings")} />

          <Pressable style={styles.logoutRow} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={17} color={colors.danger} />
            <Text style={styles.logoutText}>{t("sideMenu.logOut")}</Text>
          </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function MenuRow({ icon, label, onPress, badge }: { icon: string; label: string; onPress: () => void; badge?: number }) {
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
  container: { flex: 1, flexDirection: "row", justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(22,33,58,0.45)" },
  panel: {
    width: "78%",
    maxWidth: 320,
    height: "100%",
    backgroundColor: colors.surface,
    // paddingTop is set inline (needs insets.top, only available at
    // render time) — see the Animated.View below.
    paddingHorizontal: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 12,
  },
  closeButton: {
    position: "absolute",
    // top is set inline (needs insets.top) — see the Pressable above.
    right: spacing.md,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  profileBlock: { marginBottom: spacing.lg, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { ...typography.title },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  role: { ...typography.small, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  sectionLabel: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 9 },
  rowIconWrap: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  rowText: { ...typography.body, color: colors.textPrimary, flex: 1 },
  rowBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", fontFamily: FONT.bold },
  logoutRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xl, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  logoutText: { ...typography.body, color: colors.danger, fontWeight: "700", fontFamily: FONT.bold },
});
