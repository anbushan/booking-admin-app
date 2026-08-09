import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import SearchOptionsModal, { formatSearchDate } from "../components/SearchOptionsModal";
import { CarLoader } from "../components/CarLoader";
import { AppBottomNav } from "../components/AppBottomNav";
import { HowItWorksSheet, DRIVER_STEPS, PASSENGER_STEPS } from "../components/HowItWorksSheet";
import { api } from "../lib/api";

type Point = { lat: number; lng: number; address: string };

const DEFAULT_SOURCE: Point = { lat: 12.9352, lng: 77.6146, address: "Koramangala, Bengaluru" };

// Icon + label pairs for the driver's own action list — an icon-only
// change from before, but the whole point of this pass: "Booking
// requests" reads as an inbox, "Earnings" as a wallet, before anyone
// reads the word.
const DRIVER_ACTIONS = [
  { route: "BookingRequests", label: "Booking requests", icon: "mail-unread-outline" },
  { route: "UpcomingTrips", label: "Start trip now", icon: "navigate-outline" },
  { route: "History", label: "Your rides", params: { role: "DRIVER" }, icon: "car-outline" },
  { route: "Earnings", label: "Earnings", icon: "wallet-outline" },
] as const;

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState<Point>(DEFAULT_SOURCE);
  const [destination, setDestination] = useState<Point | null>(null);
  const [travelDate, setTravelDate] = useState(() => {
    const d = new Date();
    d.setHours(18, 30, 0, 0);
    return d;
  });
  const [seats, setSeats] = useState(1);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [profile, setProfile] = useState<{ id?: string; name?: string; role?: string } | null>(null);
  const [checkingActiveTrip, setCheckingActiveTrip] = useState(true);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [howItWorksVisible, setHowItWorksVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    api.getMyProfile().then(setProfile).catch(() => {});
  }, []);

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

  const firstName = profile?.name?.split(" ")[0];
  const isDriver = profile?.role === "DRIVER";
  // Recomputed on every render rather than once — cheap, and means the
  // greeting actually flips over if the app's just sitting open on
  // Home when the hour rolls past a boundary, not stuck on whatever it
  // was when the screen first mounted.
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good night";

  if (checkingActiveTrip) {
    // AppBottomNav still renders here, not just in the loaded return
    // below — otherwise the bar is simply absent for this first beat,
    // then pops in the moment the active-trip check resolves. Same
    // layout shell throughout, only the body swaps.
    return (
      <View style={styles.screen}>
        <View style={{ height: insets.top, backgroundColor: colors.successBg }} />
        <View style={[styles.scroll, { alignItems: "center", justifyContent: "center" }]}>
          <CarLoader size="lg" />
        </View>
        <AppBottomNav navigation={navigation} profile={profile} active="home" />
      </View>
    );
  }

  function openLocationSearch(onSelect: (loc: Point) => void) {
    navigation.navigate("LocationSearch", { onSelect, skipMapConfirm: true });
  }

  function handleSearch() {
    if (!destination) {
      openLocationSearch(setDestination);
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
        tall) so that's what actually reads as "the status bar is
        green", not a real OS-level status bar color. */}
    <View style={{ height: insets.top, backgroundColor: colors.successBg }} />
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: spacing.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} tintColor={colors.accent} />}
    >
      <View style={[styles.header, { paddingTop: spacing.lg }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name}>{firstName || "there"}</Text>
          </View>
          <Pressable style={styles.avatarButton} onPress={() => navigation.navigate("Profile")} hitSlop={8}>
            <Text style={styles.avatarButtonText}>{(profile?.name || "?").charAt(0).toUpperCase()}</Text>
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
          <Pressable style={styles.ctaMarigold} onPress={() => navigation.navigate("OfferRide")}>
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.ctaText}>Offer a ride</Text>
          </Pressable>
          {DRIVER_ACTIONS.map((action) => (
            <Pressable
              key={action.route}
              style={styles.driverActionRow}
              onPress={() => navigation.navigate(action.route, "params" in action ? action.params : undefined)}
            >
              <View style={styles.driverActionIconWrap}>
                <Ionicons name={action.icon as any} size={17} color={colors.accentText} />
              </View>
              <Text style={styles.driverActionText}>{action.label}</Text>
              {action.route === "BookingRequests" && pendingRequestCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingRequestCount > 9 ? "9+" : pendingRequestCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
          <Text style={styles.driverHint}>
            Publish a ride with your route and seats — passengers searching that route can then
            request to book. Accept or decline from "Booking requests", then start each trip from
            "Start trip now" once you arrive at pickup.
          </Text>

          {/* A static preview of the whole flow, not tied to any one
              ride — new drivers land here with zero context for what
              "Booking requests"/"Payment queue"/"Start trip now" even
              mean until they've lived through the loop once. */}
          <Pressable
            style={({ pressed }) => [styles.howItWorksCard, pressed && styles.howItWorksCardPressed]}
            onPress={() => setHowItWorksVisible(true)}
          >
            <View style={styles.howItWorksAccentBar} />
            <View style={styles.howItWorksBody}>
              <View style={styles.howItWorksHeaderRow}>
                <Ionicons name="information-circle-outline" size={16} color={colors.accentText} />
                <Text style={styles.howItWorksTitle}>New to offering rides?</Text>
              </View>
              <View style={styles.howItWorksPreviewRow}>
                {DRIVER_STEPS.map((step, i) => (
                  <React.Fragment key={step.title}>
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
                <Text style={styles.howItWorksLinkLabel}>See how it works, step by step</Text>
                <Ionicons name="chevron-forward" size={13} color={colors.accentText} />
              </View>
            </View>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.searchCard}>
            <Pressable style={styles.field} onPress={() => openLocationSearch(setSource)}>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <Text style={styles.fieldText}>{source.address}</Text>
            </Pressable>
            <Pressable
              style={[styles.field, { borderBottomWidth: 0 }]}
              onPress={() => openLocationSearch(setDestination)}
            >
              <View style={[styles.dot, { backgroundColor: colors.marigold }]} />
              <Text style={[styles.fieldText, !destination && { color: colors.textMuted }]}>
                {destination?.address || "Where to?"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <Pressable style={[styles.chip, { flex: 1 }]} onPress={() => setOptionsVisible(true)}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.chipText}>{formatSearchDate(travelDate)}</Text>
            </Pressable>
            <Pressable style={[styles.chip, { width: 76 }]} onPress={() => setOptionsVisible(true)}>
              <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.chipText}>{seats}</Text>
            </Pressable>
          </View>

          <Pressable style={styles.cta} onPress={handleSearch}>
            <Ionicons name="search-outline" size={18} color="#FFFFFF" />
            <Text style={styles.ctaText}>Search rides</Text>
          </Pressable>

          <Pressable style={styles.howItWorksLink} onPress={() => setHowItWorksVisible(true)}>
            <Ionicons name="information-circle-outline" size={14} color={colors.accentText} />
            <Text style={styles.howItWorksLinkText}>How booking a ride works</Text>
          </Pressable>

          <Text style={styles.sectionLabel}>Recent</Text>
          <Pressable
            style={styles.recentCard}
            onPress={() => setDestination({ lat: 12.8449, lng: 77.6621, address: "Electronic City, Bengaluru" })}
          >
            <View style={styles.recentIconWrap}>
              <Ionicons name="time-outline" size={15} color={colors.textMuted} />
            </View>
            <View style={styles.recentBody}>
              <View style={styles.recentRoute}>
                <View style={[styles.recentDot, { backgroundColor: colors.accent }]} />
                <Text style={styles.recentText} numberOfLines={1}>HSR Layout</Text>
              </View>
              <View style={styles.recentRoute}>
                <View style={[styles.recentDot, { backgroundColor: colors.marigold }]} />
                <Text style={styles.recentText} numberOfLines={1}>Electronic City, Bengaluru</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={styles.recentCard}
            onPress={() => setDestination({ lat: 13.0827, lng: 80.2707, address: "Chennai" })}
          >
            <View style={styles.recentIconWrap}>
              <Ionicons name="time-outline" size={15} color={colors.textMuted} />
            </View>
            <View style={styles.recentBody}>
              <View style={styles.recentRoute}>
                <View style={[styles.recentDot, { backgroundColor: colors.accent }]} />
                <Text style={styles.recentText} numberOfLines={1}>Bengaluru</Text>
              </View>
              <View style={styles.recentRoute}>
                <View style={[styles.recentDot, { backgroundColor: colors.marigold }]} />
                <Text style={styles.recentText} numberOfLines={1}>Chennai</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        </>
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
  avatarButtonText: { color: "#FFFFFF", ...typography.title, fontSize: 15 },
  greeting: { color: "#FFFFFF", opacity: 0.8, fontSize: 13 },
  name: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginTop: 2 },
  searchCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: -spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
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
    backgroundColor: colors.accent,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    height: 46,
    borderRadius: radius.sm,
  },
  ctaMarigold: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.marigold,
    height: 46,
    borderRadius: radius.sm,
  },
  ctaText: { color: "#FFFFFF", ...typography.title },
  driverPanel: { marginHorizontal: spacing.lg, marginTop: -spacing.lg },
  driverActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  driverActionIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center",
  },
  driverActionText: { ...typography.body, flex: 1 },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    backgroundColor: colors.danger, alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  driverHint: { ...typography.small, color: colors.textMuted, marginTop: spacing.lg, lineHeight: 18 },
  howItWorksCard: {
    flexDirection: "row",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, marginTop: spacing.md, overflow: "hidden",
  },
  howItWorksCardPressed: { backgroundColor: colors.accentBg },
  howItWorksAccentBar: { width: 4, backgroundColor: colors.accent },
  howItWorksBody: { flex: 1, padding: spacing.md },
  howItWorksHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  howItWorksTitle: { ...typography.caption, fontWeight: "700", color: colors.textPrimary, flex: 1 },
  howItWorksPreviewRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  howItWorksIconWrap: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  howItWorksConnector: { flex: 1, height: 1, backgroundColor: colors.border, marginHorizontal: 2 },
  howItWorksLinkRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.sm },
  howItWorksLinkLabel: { ...typography.small, color: colors.accentText, fontWeight: "700", textDecorationLine: "underline" },
  howItWorksLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: spacing.sm },
  howItWorksLinkText: { ...typography.small, color: colors.accentText, fontWeight: "700" },
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
