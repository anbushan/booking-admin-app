import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Platform } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CopilotProvider, CopilotStep, walkthroughable, useCopilot } from "react-native-copilot";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import SearchOptionsModal, { formatSearchDate } from "../components/SearchOptionsModal";
import { CarLoader } from "../components/CarLoader";
import { AppBottomNav } from "../components/AppBottomNav";
import { HowItWorksSheet, DRIVER_STEPS, PASSENGER_STEPS } from "../components/HowItWorksSheet";
import { TrustBadges } from "../components/TrustBadges";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { api } from "../lib/api";
import { useScreenView } from "../lib/useScreenView";
import Avatar from "../components/Avatar";
import { QuickActionsGrid, QuickAction } from "../components/QuickActionsGrid";
import { setRoleQuickActions } from "../lib/quickActions";
import { getRecentSearches, RecentLocation } from "../lib/recentSearches";
import { useTranslation } from "../lib/i18n/I18nContext";
import { hasSeenCopilotTour, markCopilotTourSeen } from "../lib/copilotOnboarding";
import { appEvents } from "../lib/appEvents";

// `walkthroughable` just forwards a `copilot` ref/onLayout prop into the
// wrapped component's own props — defined once at module scope (not
// inside the component body) so CopilotStep isn't handed a brand-new
// component type on every render, which would remount its child and
// break the ref registration copilot relies on to measure it.
const CopilotView = walkthroughable(View);
const CopilotPressable = walkthroughable(Pressable);

type Point = { lat: number; lng: number; address: string };
type PopularRoute = {
  sourceAddress: string; sourceLat: number; sourceLng: number;
  destAddress: string; destLat: number; destLng: number; count: number;
};

// Used to default to a hardcoded "Koramangala, Bengaluru" regardless of
// where the passenger actually was — every single person opening the
// app in Chennai, Delhi, anywhere but that one Bengaluru neighborhood
// saw a "from" address that was simply wrong until they noticed and
// changed it. Source now starts unset (matches destination's own
// null-until-picked pattern below) and gets filled in from the device's
// real GPS position on mount instead — see the effect further down.


// Wraps the actual screen in CopilotProvider so `useCopilot()` is
// available inside it — the provider has to be an ancestor of every
// CopilotStep it coordinates, and of whatever calls `start()`. Scoped
// to just this screen (not App.tsx's root) since the walkthrough only
// ever points at Home's own elements; CopilotProvider's highlight
// overlay renders through RN's own <Modal>, so nesting it here instead
// of at the root doesn't clip or mis-position it.
export default function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  return (
    <CopilotProvider
      overlay="view"
      animated
      androidStatusBarVisible
      backdropColor="rgba(22,33,58,0.7)"
      labels={{
        previous: t("copilot.labels.previous"),
        next: t("copilot.labels.next"),
        skip: t("copilot.labels.skip"),
        finish: t("copilot.labels.finish"),
      }}
    >
      <HomeScreenContent navigation={navigation} />
    </CopilotProvider>
  );
}

function HomeScreenContent({ navigation }: any) {
  useScreenView("HomeScreen");
  const { t } = useTranslation();
  const { start } = useCopilot();
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState<Point | null>(null);
  const [destination, setDestination] = useState<Point | null>(null);
  // Driver-side "quick offer" card on this same screen (see driverPanel
  // below) — its own destination field, separate from the passenger
  // search's `destination` above since the two panels are mutually
  // exclusive per role but shouldn't share state if a role switch ever
  // happens without a full remount. Reuses `source` for its "from" field
  // (GPS-filled below, same for both roles — where you are doesn't
  // depend on which one you are).
  const [offerDestination, setOfferDestination] = useState<Point | null>(null);
  const [travelDate, setTravelDate] = useState(() => {
    const d = new Date();
    d.setHours(18, 30, 0, 0);
    return d;
  });
  const [seats, setSeats] = useState(1);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [profile, setProfile] = useState<{ id?: string; name?: string; role?: string; photoViewUrl?: string | null } | null>(null);
  const [checkingActiveTrip, setCheckingActiveTrip] = useState(true);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  // Same two counts AppBottomNav's own badges already fetch — mirrored
  // here (not lifted/shared) so the new quick-actions grid's tile
  // badges match instantly rather than waiting on a navigation round
  // trip, the same reasoning pendingRequestCount above already used.
  const [upcomingTripsCount, setUpcomingTripsCount] = useState(0);
  const [myRequestsCount, setMyRequestsCount] = useState(0);
  const [howItWorksVisible, setHowItWorksVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentLocation[]>([]);
  const [popularRoutes, setPopularRoutes] = useState<PopularRoute[]>([]);
  // null while unknown (don't flash the banner before the first fetch
  // resolves); [] once confirmed empty is what actually shows it.
  const [emergencyContactCount, setEmergencyContactCount] = useState<number | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<string | null>(null);
  const [aadhaarStatus, setAadhaarStatus] = useState<string | null>(null);

  useEffect(() => {
    api.getMyProfile().then(setProfile).catch(() => {});
  }, []);

  // Best-effort real GPS fix for the "from" field on first load — silent
  // no-op on denial/failure (leaves source null, same as destination's
  // own unset state), never blocks or errors the screen over it. Only
  // fires once: a functional state update with an internal "already
  // set" guard would still be racy against a manual pick landing first,
  // so this checks the ref instead of depending on `source` (which
  // would otherwise re-fire this on every location:selected swap/pick).
  useEffect(() => {
    let cancelled = false;
    api.getCurrentLocation()
      .then((loc: Point) => { if (!cancelled) setSource((prev) => prev ?? loc); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // LocationSearchScreen reports a pick back via this event instead of a
  // callback passed through navigation params — React Navigation warns
  // ("non-serializable values were found in the navigation state") the
  // moment a function ends up in route params, since that state is
  // meant to be persistable/restorable. "home-source"/"home-destination"
  // scope this listener to picks actually meant for this screen, in case
  // another screen with its own location fields (OfferRideScreen) has a
  // listener alive at the same time.
  useEffect(() => {
    return appEvents.on("location:selected", (payload: { selectFor: string; location: Point }) => {
      if (payload.selectFor === "home-source") setSource(payload.location);
      else if (payload.selectFor === "home-destination") setDestination(payload.location);
      else if (payload.selectFor === "home-offer-destination") setOfferDestination(payload.location);
    });
  }, []);

  // Keeps the OS-level long-press-app-icon shortcuts (see
  // lib/quickActions.ts) in sync with whichever role is actually
  // active — refires on every role change (initial login, and
  // SwitchRoleScreen), not just once, so a driver who switches to
  // passenger doesn't keep seeing driver shortcuts on their launcher.
  useEffect(() => {
    if (profile?.role === "DRIVER" || profile?.role === "PASSENGER") {
      setRoleQuickActions(profile.role, t);
    }
  }, [profile?.role]);

  // Recent re-reads on every focus (a pick made on LocationSearch just
  // now should show up back here immediately); popular routes are a
  // slow-moving, shared list, fetched once.
  useFocusEffect(
    useCallback(() => {
      getRecentSearches().then(setRecentSearches);
    }, [])
  );
  useEffect(() => {
    api.getPopularRoutes().then(setPopularRoutes).catch(() => setPopularRoutes([]));
  }, []);

  // Re-reads on every focus, same reason recentSearches does — coming
  // straight back from EmergencyContacts after adding one should clear
  // this banner immediately, not leave it showing until some unrelated
  // re-render happens to trigger a refetch.
  useFocusEffect(
    useCallback(() => {
      api.getEmergencyContacts().then((list: any[]) => setEmergencyContactCount(list.length)).catch(() => {});
    }, [])
  );

  function searchRoute(src: Point, dest: Point) {
    navigation.navigate("SearchResults", {
      sourceLat: src.lat, sourceLng: src.lng, sourceAddress: src.address,
      destLat: dest.lat, destLng: dest.lng, destAddress: dest.address,
      date: travelDate.toISOString(),
      seats,
    });
  }

  // Driver's Home is the one screen that's mostly a live dashboard
  // (pending request count, quick links) rather than a form — pull to
  // refresh re-checks the profile and that count on demand, the same
  // way AppBottomNav's own badges already refresh on focus, just
  // available immediately instead of waiting for a navigation round trip.
  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        api.getMyProfile().then(setProfile).catch(() => {}),
        profile?.role === "DRIVER"
          ? api.getDriverPendingRequests().then((list: any[]) => setPendingRequestCount(list.length)).catch(() => {})
          : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  // If the app crashed, was force-quit, or reinstalled while a trip was
  // IN_PROGRESS, there was previously nothing bringing the user back to
  // that live-tracking screen — they'd land on a normal Home with no
  // trace of an active trip. Checked on every visit to Home (not just
  // first launch), since navigating here after a trip via some other
  // path should also resolve to "nothing active" cleanly.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setCheckingActiveTrip(true);
      api
        .getActiveTrip()
        .then((active) => {
          if (cancelled) return;
          if (active) {
            navigation.replace(active.role === "DRIVER" ? "ActiveTrip" : "LiveTracking", {
              bookingId: active.bookingId,
              role: active.role,
            });
          } else {
            setCheckingActiveTrip(false);
          }
        })
        .catch(() => setCheckingActiveTrip(false));
      return () => { cancelled = true; };
    }, [])
  );

  // The one number a driver actually wants on sight — how many people
  // are waiting on a response — rather than something only visible three
  // taps into "Booking requests".
  useFocusEffect(
    useCallback(() => {
      if (profile?.role !== "DRIVER") return;
      api.getDriverPendingRequests().then((list: any[]) => setPendingRequestCount(list.length)).catch(() => {});
    }, [profile?.role])
  );

  // Drives the two quick-actions grid badge tiles (Start Trip / My
  // Requests) — same filter logic and same source calls AppBottomNav's
  // own badges already use, so the numbers always agree with each other.
  useFocusEffect(
    useCallback(() => {
      if (profile?.role === "DRIVER") {
        api.getDriverActiveBookings()
          .then((list: any[]) => setUpcomingTripsCount(list.filter((t) => ["AWAITING_PAYMENT", "CONFIRMED", "IN_PROGRESS"].includes(t.status)).length))
          .catch(() => {});
      } else if (profile?.role === "PASSENGER") {
        api.getMyBookings()
          .then((list: any[]) => setMyRequestsCount(list.filter((b) => ["BOOKED", "AWAITING_PAYMENT", "PAYMENT_PENDING"].includes(b.status)).length))
          .catch(() => {});
      }
    }, [profile?.role])
  );

  // Drives the "why get verified" banner below — only fetched for
  // drivers, and only ever used to decide whether to show it (once
  // verified, it disappears; VehicleListScreen's own banner + the
  // badges everywhere else are the ongoing reminder from then on).
  useFocusEffect(
    useCallback(() => {
      if (profile?.role !== "DRIVER") return;
      api.getVerificationStatus()
        .then((data: any) => setLicenseStatus(data.driverVerification?.licenseStatus || "UNVERIFIED"))
        .catch(() => {});
    }, [profile?.role])
  );

  // Same reasoning as the driver license fetch above, mirrored for the
  // passenger-side Aadhaar badge banner below — only fetched in the
  // passenger view, hidden once verified.
  useFocusEffect(
    useCallback(() => {
      if (profile?.role !== "PASSENGER") return;
      api.getPassengerVerificationStatus()
        .then((data: any) => setAadhaarStatus(data.passengerVerification?.aadhaarStatus || "UNVERIFIED"))
        .catch(() => {});
    }, [profile?.role])
  );

  const firstName = profile?.name?.split(" ")[0];
  const isDriver = profile?.role === "DRIVER";
  // Recomputed on every render rather than once — cheap, and means the
  // greeting actually flips over if the app's just sitting open on
  // Home when the hour rolls past a boundary, not stuck on whatever it
  // was when the screen first mounted.
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("home.goodMorning") : hour < 17 ? t("home.goodAfternoon") : hour < 21 ? t("home.goodEvening") : t("home.goodNight");

  // Visual, icon-first quick-actions grid — replaces the old plain
  // text-row DRIVER_ACTIONS list for drivers, and gives passengers an
  // equivalent set of shortcuts they never had before (previously only
  // the search form itself). Badge counts mirror AppBottomNav's own
  // badges exactly (same source calls, same filters — see the
  // useFocusEffect above), so a number here always agrees with the one
  // on the tab it corresponds to.
  const driverQuickActions: QuickAction[] = [
    { key: "requests", label: t("home.bookingRequests"), icon: "mail-unread-outline", onPress: () => navigation.navigate("BookingRequests"), badge: pendingRequestCount },
    { key: "startTrip", label: t("home.startTripNow"), icon: "navigate-outline", onPress: () => navigation.navigate("UpcomingTrips"), badge: upcomingTripsCount, tint: "marigold" },
    { key: "myRides", label: t("home.yourRides"), icon: "car-outline", onPress: () => navigation.navigate("History", { role: "DRIVER" }) },
    { key: "earnings", label: t("home.earnings"), icon: "wallet-outline", onPress: () => navigation.navigate("Earnings"), tint: "success" },
    { key: "vehicles", label: t("sideMenu.myVehicles"), icon: "car-sport-outline", onPress: () => navigation.navigate("VehicleList") },
    { key: "paymentQueue", label: t("sideMenu.paymentQueue"), icon: "cash-outline", onPress: () => navigation.navigate("PaymentQueue") },
  ];
  const passengerQuickActions: QuickAction[] = [
    { key: "myRequests", label: t("navTabs.myRequests"), icon: "list-outline", onPress: () => navigation.navigate("MyRequests"), badge: myRequestsCount },
    { key: "bookings", label: t("navTabs.bookings"), icon: "receipt-outline", onPress: () => navigation.navigate("History", { role: "PASSENGER" }) },
    { key: "verifyId", label: t("verification.passengerLink"), icon: "shield-checkmark-outline", onPress: () => navigation.navigate("VerifyPassenger"), tint: "success" },
    { key: "chat", label: t("chatList.title"), icon: "chatbubbles-outline", onPress: () => navigation.navigate("ChatList") },
    { key: "emergencyContacts", label: t("settings.emergencyContacts"), icon: "shield-checkmark-outline", onPress: () => navigation.navigate("EmergencyContacts"), tint: "danger" },
    { key: "helpSupport", label: t("settings.helpSupport"), icon: "help-buoy-outline", onPress: () => navigation.navigate("HelpSupport"), tint: "marigold" },
  ];

  // Auto-starts the walkthrough exactly once per role, the first time
  // that role's real Home content (with its CopilotSteps registered)
  // is actually on screen — gated on `!checkingActiveTrip` so this
  // never fires against the loading branch below, which renders no
  // CopilotSteps at all. React fires a CopilotStep's own registration
  // effect (child) before this one (parent) on the same commit, so by
  // the time this runs the steps `start()` needs are already known.
  useEffect(() => {
    // react-native-copilot's overlay waits on an internal onLayout inside
    // its own <Modal> to self-measure before it can show anything — that
    // callback never reliably fires for Modal content under
    // react-native-web (confirmed: start() runs, but its promise chain
    // just hangs, no error), so there's nothing to show on web. Real
    // users only ever see this screen on Android/iOS, where it works;
    // skip it here rather than silently doing nothing.
    if (Platform.OS === "web" || !profile?.role || checkingActiveTrip) return;
    const role = profile.role as "DRIVER" | "PASSENGER";
    let cancelled = false;
    hasSeenCopilotTour(role).then((seen) => {
      if (seen || cancelled) return;
      start();
      markCopilotTourSeen(role);
    });
    return () => { cancelled = true; };
  }, [profile?.role, checkingActiveTrip]);

  if (checkingActiveTrip) {
    // AppBottomNav still renders here, not just in the loaded return
    // below — otherwise the bar is simply absent for this first beat,
    // then pops in the moment the active-trip check resolves. Same
    // layout shell throughout, only the body swaps.
    return (
      <View style={styles.screen}>
        <View style={{ height: insets.top, backgroundColor: colors.bg }} />
        <View style={[styles.scroll, { alignItems: "center", justifyContent: "center" }]}>
          <CarLoader size="lg" />
        </View>
        <AppBottomNav navigation={navigation} profile={profile} active="home" />
      </View>
    );
  }

  function openLocationSearch(selectFor: "home-source" | "home-destination" | "home-offer-destination") {
    navigation.navigate("LocationSearch", { selectFor, skipMapConfirm: true });
  }

  function handleSearch() {
    // Source can now be genuinely unset (no more fake hardcoded default,
    // and a denied/slow GPS fix leaves it null) — same "send them to
    // pick it" treatment destination already got below, not a silent
    // fallback to some made-up address.
    if (!source) {
      openLocationSearch("home-source");
      return;
    }
    if (!destination) {
      openLocationSearch("home-destination");
      return;
    }
    navigation.navigate("SearchResults", {
      sourceLat: source.lat,
      sourceLng: source.lng,
      sourceAddress: source.address,
      destLat: destination.lat,
      destLng: destination.lng,
      destAddress: destination.address,
      date: travelDate.toISOString(),
      seats,
    });
  }

  return (
    <View style={styles.screen}>
    {/* Android 15 (this app's target SDK) enforces edge-to-edge — the
        real status bar is always transparent there and ignores
        setStatusBarBackgroundColor entirely, ever since that API was
        deprecated. The only way to get a colored status bar area is to
        paint the app's own content that color, since it shows through:
        this strip sits exactly under the status bar/notch (insets.top
        tall) so that's what actually reads as "the status bar is white",
        not a real OS-level status bar color. Was colors.successBg (a
        leftover green from before the app-wide white/Rapido-style pass)
        — matched colors.bg like every other screen now. */}
    <View style={{ height: insets.top, backgroundColor: colors.bg }} />
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} tintColor={colors.accent} />}
    >
      <View style={[styles.header, { paddingTop: spacing.lg }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name}>{firstName || t("home.thereFallback")}</Text>
            {/* Manual re-trigger — the auto-start (see the effect above)
                only ever fires once per role, so this is the only way
                back into the walkthrough after that first look. Hidden
                on web for the same reason the auto-start is skipped
                there — see that effect's comment. */}
            {Platform.OS !== "web" && (
              <Pressable style={styles.tourLink} onPress={() => start()} hitSlop={6}>
                <Ionicons name="sparkles-outline" size={12} color="#FFFFFF" />
                <Text style={styles.tourLinkText}>{t("home.takeTour")}</Text>
              </Pressable>
            )}
          </View>
          <Pressable style={styles.avatarButton} onPress={() => navigation.navigate("Profile")} hitSlop={8}>
            <Avatar
              uri={profile?.photoViewUrl}
              name={profile?.name}
              size={38}
              fallbackStyle={{ backgroundColor: "transparent" }}
              fallbackTextStyle={{ color: "#FFFFFF" }}
            />
          </Pressable>
        </View>
      </View>

      {isDriver ? (
        // Drivers publish rides for passengers to find and request — they
        // don't search/book themselves (the backend enforces this: booking
        // creation requires the PASSENGER role). Showing the passenger
        // search UI here was actively misleading, since trying to "book" a
        // ride as a driver account would just fail. This is the driver's
        // actual loop: publish, then respond to requests as they come in.
        <View style={styles.driverPanel}>
          {/* Quick offer — lets a driver pick their route right here on
              Home instead of only after tapping through to the full
              OfferRide screen. Picking is optional: "Offer a ride" below
              carries whatever's set here along as a prefill (OfferRide's
              own GPS fallback covers "from" if this is skipped), so
              nothing here blocks or changes what happens if the driver
              just taps straight through like before. */}
          <View style={styles.offerQuickCard}>
            <Pressable style={styles.field} onPress={() => openLocationSearch("home-source")}>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <Text style={[styles.fieldText, !source && { color: colors.textMuted }]}>
                {source?.address || t("home.whereFrom")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.field, { borderBottomWidth: 0 }]}
              onPress={() => openLocationSearch("home-offer-destination")}
            >
              <View style={[styles.dot, { backgroundColor: colors.marigold }]} />
              <Text style={[styles.fieldText, !offerDestination && { color: colors.textMuted }]}>
                {offerDestination?.address || t("home.whereTo")}
              </Text>
            </Pressable>
            {!!source && !!offerDestination && (
              <Pressable
                style={styles.swapButton}
                onPress={() => { const s = source; setSource(offerDestination); setOfferDestination(s); }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("home.swapLocations")}
              >
                <Ionicons name="swap-vertical" size={16} color={colors.accentText} />
              </Pressable>
            )}
          </View>
          <CopilotStep name="driverOfferRide" order={1} text={t("copilot.driver.step1")}>
            <CopilotPressable
              style={styles.ctaMarigold}
              onPress={() => navigation.navigate("OfferRide", {
                ...(source ? { initialSource: source } : {}),
                ...(offerDestination ? { initialDestination: offerDestination } : {}),
              })}
            >
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.ctaText}>{t("home.offerARide")}</Text>
            </CopilotPressable>
          </CopilotStep>
          <CopilotStep name="driverActions" order={2} text={t("copilot.driver.step2")}>
            <CopilotView>
              <QuickActionsGrid actions={driverQuickActions} />
            </CopilotView>
          </CopilotStep>
          <Text style={styles.driverHint}>{t("home.driverHint")}</Text>

          {/* Advertises the paid Eko verification badge right on Home,
              not just tucked away in the vehicle list — visible the
              moment an unverified driver opens the app, gone once
              they've actually verified (VehicleListScreen's own banner
              + the badge everywhere else carry it from there). */}
          {licenseStatus != null && licenseStatus !== "VERIFIED" && (
            <Pressable style={styles.verifyBanner} onPress={() => navigation.navigate("VerifyDriver")}>
              <View style={styles.verifyBannerIconWrap}>
                <Ionicons name="shield-checkmark" size={16} color={colors.accentText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.verifyBannerTitle}>{t("verification.homeBannerTitle")}</Text>
                <Text style={styles.verifyBannerBody}>{t("verification.homeBannerBody")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.accentText} />
            </Pressable>
          )}

          {/* A static preview of the whole flow, not tied to any one
              ride — new drivers land here with zero context for what
              "Booking requests"/"Payment queue"/"Start trip now" even
              mean until they've lived through the loop once. */}
          <CopilotStep name="driverHowItWorks" order={3} text={t("copilot.driver.step3")}>
            <CopilotPressable
              style={({ pressed }: { pressed: boolean }) => [styles.howItWorksCard, pressed && styles.howItWorksCardPressed]}
              onPress={() => setHowItWorksVisible(true)}
            >
              <View style={styles.howItWorksAccentBar} />
              <View style={styles.howItWorksBody}>
                <View style={styles.howItWorksHeaderRow}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.accentText} />
                  <Text style={styles.howItWorksTitle}>{t("home.newToOfferingRides")}</Text>
                </View>
                <View style={styles.howItWorksPreviewRow}>
                  {DRIVER_STEPS.map((step, i) => (
                    <React.Fragment key={step.titleKey}>
                      <View style={styles.howItWorksIconWrap}>
                        <Ionicons name={step.icon} size={13} color={colors.accentText} />
                      </View>
                      {i < DRIVER_STEPS.length - 1 && <View style={styles.howItWorksConnector} />}
                    </React.Fragment>
                  ))}
                </View>
                {/* An explicit, underlined "link" label — the icon-row
                    above plus a bare chevron wasn't reading as tappable on
                    its own; this makes the clickability unambiguous. */}
                <View style={styles.howItWorksLinkRow}>
                  <Text style={styles.howItWorksLinkLabel}>{t("home.seeHowItWorks")}</Text>
                  <Ionicons name="chevron-forward" size={13} color={colors.accentText} />
                </View>
              </View>
            </CopilotPressable>
          </CopilotStep>

          <TrustBadges role="DRIVER" />
        </View>
      ) : (
        <>
          <CopilotStep name="passengerSearch" order={1} text={t("copilot.passenger.step1")}>
            <CopilotView style={styles.searchCard}>
              <Pressable style={styles.field} onPress={() => openLocationSearch("home-source")}>
                <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.fieldText, !source && { color: colors.textMuted }]}>
                  {source?.address || t("home.whereFrom")}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.field, { borderBottomWidth: 0 }]}
                onPress={() => openLocationSearch("home-destination")}
              >
                <View style={[styles.dot, { backgroundColor: colors.marigold }]} />
                <Text style={[styles.fieldText, !destination && { color: colors.textMuted }]}>
                  {destination?.address || t("home.whereTo")}
                </Text>
              </Pressable>
              {/* BlaBlaCar-style swap button — sits right on the divider
                  between the two fields, only worth showing once both
                  are actually set (nothing useful to swap otherwise). */}
              {!!source && !!destination && (
                <Pressable
                  style={styles.swapButton}
                  onPress={() => { setSource(destination); setDestination(source); }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.swapLocations")}
                >
                  <Ionicons name="swap-vertical" size={16} color={colors.accentText} />
                </Pressable>
              )}
            </CopilotView>
          </CopilotStep>

          <CopilotStep name="passengerOptions" order={2} text={t("copilot.passenger.step2")}>
            <CopilotView style={styles.row}>
              <Pressable style={[styles.chip, { flex: 1 }]} onPress={() => setOptionsVisible(true)}>
                <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.chipText}>{formatSearchDate(travelDate, t)}</Text>
              </Pressable>
              <Pressable style={[styles.chip, { width: 76 }]} onPress={() => setOptionsVisible(true)}>
                <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.chipText}>{seats}</Text>
              </Pressable>
            </CopilotView>
          </CopilotStep>

          <CopilotStep name="passengerSearchButton" order={3} text={t("copilot.passenger.step3")}>
            <CopilotPressable style={styles.cta} onPress={handleSearch}>
              <Ionicons name="search-outline" size={18} color="#FFFFFF" />
              <Text style={styles.ctaText}>{t("home.searchRides")}</Text>
            </CopilotPressable>
          </CopilotStep>

          <Pressable style={styles.howItWorksLink} onPress={() => setHowItWorksVisible(true)}>
            <Ionicons name="information-circle-outline" size={14} color={colors.accentText} />
            <Text style={styles.howItWorksLinkText}>{t("home.howBookingWorks")}</Text>
          </Pressable>

          {/* Passengers had zero quick-action shortcuts before this —
              only the search form itself. Same icon-grid pattern as the
              driver side above, same badge visual language. */}
          <CopilotStep name="passengerQuickActions" order={4} text={t("copilot.passenger.step4")}>
            <CopilotView>
              <QuickActionsGrid actions={passengerQuickActions} />
            </CopilotView>
          </CopilotStep>

          <TrustBadges role="PASSENGER" />

          {/* Same idea as the driver license banner above — advertises
              the optional passenger ID badge right on Home, not just
              tucked into Profile. Shows the actual VerifiedBadge
              component so "how it looks" isn't just a claim, plus the
              same benefit bullets VerifyPassengerScreen leads with.
              Gone once verified — the badge itself carries it from
              there (BookingRequestsScreen etc. on the driver's side). */}
          {aadhaarStatus != null && aadhaarStatus !== "VERIFIED" && (
            <Pressable style={styles.idVerifyCard} onPress={() => navigation.navigate("VerifyPassenger")}>
              <View style={styles.idVerifyHeaderRow}>
                <View style={styles.verifyBannerIconWrap}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.accentText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.verifyBannerTitle}>{t("verification.passengerHomeBannerTitle")}</Text>
                  <Text style={styles.verifyBannerBody}>{t("verification.passengerHomeBannerBody")}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.accentText} />
              </View>

              <View style={styles.idVerifyPreviewRow}>
                <Text style={styles.idVerifyPreviewLabel}>{t("verification.homeBannerPreviewLabel")}</Text>
                <VerifiedBadge verified size="sm" label={t("verification.idVerifiedLabel")} />
              </View>

              <View style={styles.idVerifyBenefits}>
                <View style={styles.idVerifyBenefitRow}>
                  <Ionicons name="checkmark-circle-outline" size={13} color={colors.success} />
                  <Text style={styles.idVerifyBenefitText}>{t("verification.passengerWhyBenefit1")}</Text>
                </View>
                <View style={styles.idVerifyBenefitRow}>
                  <Ionicons name="checkmark-circle-outline" size={13} color={colors.success} />
                  <Text style={styles.idVerifyBenefitText}>{t("verification.passengerWhyBenefit2")}</Text>
                </View>
              </View>
            </Pressable>
          )}

          {popularRoutes.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>{t("home.popularRoutes")}</Text>
              {popularRoutes.map((r) => (
                <Pressable
                  key={`${r.sourceAddress}-${r.destAddress}`}
                  style={styles.recentCard}
                  onPress={() =>
                    searchRoute(
                      { lat: r.sourceLat, lng: r.sourceLng, address: r.sourceAddress },
                      { lat: r.destLat, lng: r.destLng, address: r.destAddress }
                    )
                  }
                >
                  <View style={styles.recentIconWrap}>
                    <Ionicons name="trending-up-outline" size={15} color={colors.textMuted} />
                  </View>
                  <View style={styles.recentBody}>
                    <View style={styles.recentRoute}>
                      <View style={[styles.recentDot, { backgroundColor: colors.accent }]} />
                      <Text style={styles.recentText} numberOfLines={1}>{r.sourceAddress}</Text>
                    </View>
                    <View style={styles.recentRoute}>
                      <View style={[styles.recentDot, { backgroundColor: colors.marigold }]} />
                      <Text style={styles.recentText} numberOfLines={1}>{r.destAddress}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </>
          )}

          {recentSearches.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>{t("home.recent")}</Text>
              {recentSearches.map((loc) => (
                <Pressable
                  key={loc.address}
                  style={styles.recentCard}
                  onPress={() => setDestination(loc)}
                >
                  <View style={styles.recentIconWrap}>
                    <Ionicons name="time-outline" size={15} color={colors.textMuted} />
                  </View>
                  <View style={styles.recentBody}>
                    <View style={styles.recentRoute}>
                      <View style={[styles.recentDot, { backgroundColor: colors.marigold }]} />
                      <Text style={styles.recentText} numberOfLines={1}>{loc.address}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </>
          )}
        </>
      )}

      {/* The SOS button on every trip (see TrustBadges above) is only
          actually useful if there's someone configured to notify —
          triggering it with zero emergency contacts set up silently
          notifies no one (see LiveTrackingScreen's own fix for that
          moment). Surfacing it here, proactively, means a driver/
          passenger finds out before an emergency, not during one. */}
      {emergencyContactCount === 0 && (
        <Pressable style={styles.sosBanner} onPress={() => navigation.navigate("EmergencyContacts")}>
          <View style={styles.sosBannerIconWrap}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sosBannerTitle}>{t("home.noEmergencyContactTitle")}</Text>
            <Text style={styles.sosBannerBody}>{t("home.noEmergencyContactBody")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      )}

      <SearchOptionsModal
        visible={optionsVisible}
        initialDate={travelDate}
        initialSeats={seats}
        onClose={() => setOptionsVisible(false)}
        onConfirm={(date, newSeats) => {
          setTravelDate(date);
          setSeats(newSeats);
          setOptionsVisible(false);
        }}
      />

    </ScrollView>

    <HowItWorksSheet
      visible={howItWorksVisible}
      role={profile?.role as "DRIVER" | "PASSENGER" | undefined}
      onClose={() => setHowItWorksVisible(false)}
    />

    <AppBottomNav navigation={navigation} profile={profile} active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  // Was near-black (colors.textPrimary) — read as flat and out of place
  // against the rest of the app's warm, light palette. The blue accent
  // is the app's own brand color already carrying every primary CTA
  // (search button, chips, badges), so the header now reads as "this
  // app" rather than a generic dark bar, for both driver and passenger.
  header: { backgroundColor: colors.accent, padding: spacing.lg, paddingBottom: spacing.xl },
  headerTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  avatarButton: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center", justifyContent: "center",
  },
  greeting: { color: "#FFFFFF", opacity: 0.8, fontSize: 13 },
  name: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", fontFamily: FONT.bold, marginTop: 2 },
  tourLink: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 6 },
  tourLinkText: { color: "#FFFFFF", opacity: 0.85, fontSize: 11, fontWeight: "700", fontFamily: FONT.bold, textDecorationLine: "underline" },
  searchCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: -spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    position: "relative",
  },
  swapButton: {
    position: "absolute",
    right: spacing.md,
    top: "50%",
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    // Sits above the two field rows' own borders/backgrounds without
    // needing an elevation hack — a plain absolute sibling already
    // paints after them in document order.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  fieldText: { ...typography.body, color: colors.textPrimary },
  row: { flexDirection: "row", gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  chipText: typography.caption,
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.textPrimary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    height: 46,
    borderRadius: radius.sm,
  },
  // Was colors.marigold — the one splash of a second brand color on
  // the app's most-viewed screen, but it made the driver and passenger
  // Home read as two different products rather than two modes of the
  // same one. Every primary button app-wide is colors.textPrimary now;
  // this matches.
  ctaMarigold: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
  },
  ctaText: { ...typography.title, color: "#FFFFFF" },
  driverPanel: { marginHorizontal: spacing.lg, marginTop: -spacing.lg },
  // Same look as the passenger searchCard, but without its own
  // marginHorizontal/marginTop — driverPanel above already supplies
  // that indent + overlap-the-header offset, so this just needs to be a
  // plain card sitting inside it with a gap before the CTA button below.
  offerQuickCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    position: "relative",
  },
  driverHint: { ...typography.small, color: colors.textMuted, marginTop: spacing.lg, lineHeight: 18 },
  verifyBanner: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.accentBg, borderRadius: radius.md,
    marginTop: spacing.md, padding: spacing.md,
  },
  verifyBannerIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  verifyBannerTitle: { ...typography.caption, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  verifyBannerBody: { ...typography.small, color: colors.textSecondary, marginTop: 1, lineHeight: 15 },
  idVerifyCard: {
    backgroundColor: colors.accentBg, borderRadius: radius.md,
    marginTop: spacing.md, padding: spacing.md, gap: spacing.sm,
  },
  idVerifyHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  idVerifyPreviewRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.surface, borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
  },
  idVerifyPreviewLabel: { ...typography.small, color: colors.textMuted },
  idVerifyBenefits: { gap: spacing.xs },
  idVerifyBenefitRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  idVerifyBenefitText: { ...typography.small, color: colors.textSecondary, flex: 1 },
  howItWorksCard: {
    flexDirection: "row",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, marginTop: spacing.md, overflow: "hidden",
  },
  howItWorksCardPressed: { backgroundColor: colors.accentBg },
  howItWorksAccentBar: { width: 4, backgroundColor: colors.accent },
  howItWorksBody: { flex: 1, padding: spacing.md },
  howItWorksHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  howItWorksTitle: { ...typography.caption, fontWeight: "700", fontFamily: FONT.bold, color: colors.textPrimary, flex: 1 },
  howItWorksPreviewRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  howItWorksIconWrap: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  howItWorksConnector: { flex: 1, height: 1, backgroundColor: colors.border, marginHorizontal: 2 },
  howItWorksLinkRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  howItWorksLinkLabel: { ...typography.small, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold, textDecorationLine: "underline" },
  howItWorksLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, marginTop: spacing.sm },
  howItWorksLinkText: { ...typography.small, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  sosBanner: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.danger,
    borderRadius: radius.md, padding: spacing.md,
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
  },
  sosBannerIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  sosBannerTitle: { ...typography.caption, fontWeight: "700", fontFamily: FONT.bold, color: colors.danger },
  sosBannerBody: { ...typography.small, color: colors.textSecondary, marginTop: 1 },
  sectionLabel: {
    ...typography.title,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  recentIconWrap: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  recentBody: { flex: 1, gap: 3 },
  recentRoute: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  recentDot: { width: 6, height: 6, borderRadius: 3 },
  recentText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
});
