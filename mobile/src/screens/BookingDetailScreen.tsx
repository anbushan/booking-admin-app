import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { CarLoader } from "../components/CarLoader";
import { StatusBadge } from "../components/StatusBadge";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";

export default function BookingDetailScreen({ route, navigation }: any) {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Refetches every time this screen regains focus, not just on first
  // mount — status/refund/cash-collected fields here can all change
  // while the passenger/driver is elsewhere (chat, live tracking,
  // payment). `loading` only ever gates the very first fetch, so a
  // background refresh on refocus doesn't flash the spinner over
  // content that's already on screen.
  useFocusEffect(
    useCallback(() => {
      api.getBookingDetail(bookingId)
        .then(setBooking)
        .catch(() => setBooking((prev: any) => prev ?? null))
        .finally(() => setLoading(false));
    }, [bookingId])
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.screen, { justifyContent: "center", alignItems: "center" }]} edges={["top", "bottom"]}>
        <CarLoader />
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={[styles.screen, { justifyContent: "center", alignItems: "center" }]} edges={["top", "bottom"]}>
        <Text style={styles.notFound}>Booking not found.</Text>
      </SafeAreaView>
    );
  }

  const amount = Number(booking.ride.pricePerSeat) * booking.seatsBooked;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title="Booking" onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <Text style={styles.route}>{booking.ride.sourceAddress} to {booking.ride.destAddress}</Text>
        <Text style={styles.date}>{new Date(booking.ride.travelDate).toLocaleString()}</Text>

        <View style={styles.card}>
          {/* Names link through to the public profile — every other list
              in the app that shows a driver/passenger already does this;
              this screen just hadn't caught up. */}
          <Pressable
            style={styles.row}
            disabled={!booking.ride.driver.id}
            onPress={() => navigation.navigate("PublicProfile", { userId: booking.ride.driver.id })}
          >
            <Text style={styles.label}>Driver</Text>
            <View style={styles.valueRow}>
              <Text style={styles.value}>{booking.ride.driver.name || booking.ride.driver.phone}</Text>
              {!!booking.ride.driver.id && <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
            </View>
          </Pressable>
          <Pressable
            style={styles.row}
            disabled={!booking.passenger.id}
            onPress={() => navigation.navigate("PublicProfile", { userId: booking.passenger.id })}
          >
            <Text style={styles.label}>Passenger</Text>
            <View style={styles.valueRow}>
              <Text style={styles.value}>{booking.passenger.name || booking.passenger.phone}</Text>
              {!!booking.passenger.id && <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
            </View>
          </Pressable>
          <View style={styles.row}>
            <Text style={styles.label}>Seats</Text>
            <Text style={styles.value}>{booking.seatsBooked}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Fare</Text>
            <Text style={styles.value}>Rs {amount}</Text>
          </View>
          {booking.remainingFareAmount != null && (
            <View style={styles.row}>
              <Text style={styles.label}>Cash/UPI due to driver</Text>
              <Text style={styles.value}>Rs {Number(booking.remainingFareAmount)}</Text>
            </View>
          )}
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Status</Text>
            <StatusBadge status={booking.status} size="sm" />
          </View>
        </View>

        {!!booking.platformFeePaidAt && (
          <Pressable
            style={styles.actionButton}
            onPress={() => navigation.navigate("PaymentDetail", { booking })}
          >
            <Text style={styles.actionButtonText}>View receipt</Text>
          </Pressable>
        )}
        {booking.refund && (
          <Pressable
            style={styles.actionButton}
            onPress={() => navigation.navigate("RefundStatus", { refund: booking.refund })}
          >
            <Text style={styles.actionButtonText}>View refund status</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  back: { fontSize: 18 },
  title: typography.title,
  body: { padding: spacing.lg },
  route: { ...typography.title, fontSize: 15 },
  date: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { ...typography.caption, color: colors.textSecondary },
  valueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  value: typography.body,
  actionButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  actionButtonText: { ...typography.body, color: colors.accentText },
  notFound: { ...typography.body, color: colors.textMuted },
});
