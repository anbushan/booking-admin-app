import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, typography } from "../theme/theme";
import SearchOptionsModal, { formatSearchDate } from "../components/SearchOptionsModal";
import SideMenu from "../components/SideMenu";
import { api } from "../lib/api";

type Point = { lat: number; lng: number; address: string };

const DEFAULT_SOURCE: Point = { lat: 12.9352, lng: 77.6146, address: "Koramangala, Bengaluru" };

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
  const [menuVisible, setMenuVisible] = useState(false);
  const [profile, setProfile] = useState<{ id?: string; name?: string; role?: string } | null>(null);

  useEffect(() => {
    api.getMyProfile().then(setProfile).catch(() => {});
  }, []);

  const firstName = profile?.name?.split(" ")[0];

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
    <ScrollView style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerTopRow}>
          <Pressable style={styles.iconButton} onPress={() => setMenuVisible(true)} hitSlop={8}>
            <Text style={styles.iconText}>{"☰"}</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => navigation.navigate("Notifications")} hitSlop={8}>
            <Text style={styles.iconText}>{"\u{1F514}"}</Text>
          </Pressable>
        </View>
        <Text style={styles.greeting}>Good morning</Text>
        <Text style={styles.name}>{firstName || "there"}</Text>
      </View>

      {profile?.role === "DRIVER" ? (
        // Drivers publish rides for passengers to find and request — they
        // don't search/book themselves (the backend enforces this: booking
        // creation requires the PASSENGER role). Showing the passenger
        // search UI here was actively misleading, since trying to "book" a
        // ride as a driver account would just fail. This is the driver's
        // actual loop: publish, then respond to requests as they come in.
        <View style={styles.driverPanel}>
          <Pressable style={styles.searchButton} onPress={() => navigation.navigate("OfferRide")}>
            <Text style={styles.searchButtonText}>Offer a ride</Text>
          </Pressable>
          <Pressable
            style={styles.driverActionRow}
            onPress={() => navigation.navigate("BookingRequests")}
          >
            <Text style={styles.driverActionText}>Booking requests</Text>
            <Text style={styles.driverActionChevron}>{">"}</Text>
          </Pressable>
          <Pressable
            style={styles.driverActionRow}
            onPress={() => navigation.navigate("UpcomingTrips")}
          >
            <Text style={styles.driverActionText}>Upcoming trips</Text>
            <Text style={styles.driverActionChevron}>{">"}</Text>
          </Pressable>
          <Pressable
            style={styles.driverActionRow}
            onPress={() => navigation.navigate("History", { role: "DRIVER" })}
          >
            <Text style={styles.driverActionText}>Your rides</Text>
            <Text style={styles.driverActionChevron}>{">"}</Text>
          </Pressable>
          <Pressable style={styles.driverActionRow} onPress={() => navigation.navigate("Earnings")}>
            <Text style={styles.driverActionText}>Earnings</Text>
            <Text style={styles.driverActionChevron}>{">"}</Text>
          </Pressable>
          <Text style={styles.driverHint}>
            Publish a ride with your route and seats — passengers searching that route can then
            request to book. Accept or decline from "Booking requests", then start each trip from
            "Upcoming trips" once you arrive at pickup.
          </Text>
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
              <View style={[styles.dot, { backgroundColor: colors.danger }]} />
              <Text style={[styles.fieldText, !destination && { color: colors.textMuted }]}>
                {destination?.address || "Where to?"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <Pressable style={[styles.chip, { flex: 1 }]} onPress={() => setOptionsVisible(true)}>
              <Text style={styles.chipText}>{formatSearchDate(travelDate)}</Text>
            </Pressable>
            <Pressable style={[styles.chip, { width: 64 }]} onPress={() => setOptionsVisible(true)}>
              <Text style={styles.chipText}>{seats}</Text>
            </Pressable>
          </View>

          <Pressable style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search rides</Text>
          </Pressable>

          <Text style={styles.sectionLabel}>Recent</Text>
          <Pressable
            style={styles.recentRow}
            onPress={() => setDestination({ lat: 12.8449, lng: 77.6621, address: "Electronic City, Bengaluru" })}
          >
            <Text style={styles.recentText}>HSR Layout to Electronic City</Text>
          </Pressable>
          <Pressable
            style={styles.recentRow}
            onPress={() => setDestination({ lat: 13.0827, lng: 80.2707, address: "Chennai" })}
          >
            <Text style={styles.recentText}>Bengaluru to Chennai</Text>
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

      <SideMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        navigation={navigation}
        profile={profile}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.textPrimary, padding: spacing.lg, paddingBottom: spacing.xl },
  headerTopRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  iconButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 18, color: "#FFFFFF" },
  greeting: { color: "#FFFFFF", opacity: 0.8, fontSize: 13 },
  name: { color: "#FFFFFF", fontSize: 18, fontWeight: "500", marginTop: 2 },
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: "center",
  },
  chipText: typography.caption,
  searchButton: {
    backgroundColor: colors.textPrimary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    height: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButtonText: { color: "#FFFFFF", ...typography.title },
  driverPanel: { marginHorizontal: spacing.lg, marginTop: -spacing.lg },
  driverActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  driverActionText: typography.body,
  driverActionChevron: { color: colors.textMuted },
  driverHint: { ...typography.small, color: colors.textMuted, marginTop: spacing.lg, lineHeight: 18 },
  sectionLabel: {
    ...typography.title,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  recentRow: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  recentText: { ...typography.caption, color: colors.textSecondary },
});
