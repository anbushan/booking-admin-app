import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { primeLocationIfNeeded } from "../lib/locationPriming";
import { SafeAreaView } from "react-native-safe-area-context";

const OTP_LENGTH = 4;

export default function TripOtpScreen({ route, navigation }: any) {
  const { bookingId } = route.params;
  const [otp, setOtp] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("your driver");
  const [driverRating, setDriverRating] = useState<number | null>(null);
  const [routeLabel, setRouteLabel] = useState<string | null>(null);

  useEffect(() => {
    // The OTP is generated server-side when the driver taps "Start trip"
    // and delivered to this screen — never sent by SMS, so it isn't
    // dependent on carrier delivery at a possibly low-signal pickup point.
    api.getTripOtp(bookingId).then((res) => setOtp(res.otp));
    api
      .getBookingDetail(bookingId)
      .then((booking) => {
        if (booking.ride?.driver?.name) setDriverName(booking.ride.driver.name);
        if (booking.ride?.driver?.ratingAvg != null) setDriverRating(booking.ride.driver.ratingAvg);
        if (booking.ride) setRouteLabel(`${booking.ride.sourceAddress} to ${booking.ride.destAddress}`);
      })
      .catch(() => {});
  }, [bookingId]);

  const digits = (otp || "").padEnd(OTP_LENGTH, " ").slice(0, OTP_LENGTH).split("");

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"x"}</Text>
        </Pressable>
        <Text style={styles.title}>Your driver has arrived</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.instruction}>Share this code with {driverName}</Text>
        <View style={styles.otpRow}>
          {digits.map((d, i) => (
            <View key={i} style={styles.otpBox}>
              <Text style={styles.otpDigit}>{otp ? d : ""}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.hint}>Confirms it's your ride — only share it once the driver asks</Text>
        <Text style={styles.altHint}>Trouble with the code? Your driver can also start the trip with your Booking ID: {bookingId}</Text>
        {routeLabel && <Text style={styles.routeLabel}>{routeLabel}</Text>}
      </View>

      <View style={styles.driverBar}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{driverName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.driverName}>{driverName}</Text>
          {driverRating != null && <Text style={styles.driverMeta}>{driverRating.toFixed(1)} rating</Text>}
        </View>
      </View>

      <Pressable
        style={styles.trackButton}
        onPress={() => primeLocationIfNeeded(navigation, "LiveTracking", { bookingId, role: "PASSENGER" })}
      >
        <Text style={styles.trackButtonText}>Track this trip</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  back: { fontSize: 18 },
  title: typography.title,
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  instruction: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: "center" },
  otpRow: { flexDirection: "row", gap: spacing.sm },
  otpBox: {
    width: 56,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  otpDigit: { fontSize: 28, fontWeight: "600", color: colors.accentText },
  hint: { ...typography.small, color: colors.textMuted, marginTop: spacing.lg, textAlign: "center" },
  altHint: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm, textAlign: "center" },
  routeLabel: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, textAlign: "center" },
  driverBar: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.accentText, fontWeight: "600", fontSize: 16 },
  driverName: { ...typography.body, fontWeight: "500" },
  driverMeta: { ...typography.small, color: colors.textMuted },
  trackButton: { backgroundColor: colors.textPrimary, height: 48, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", margin: spacing.lg },
  trackButtonText: { color: "#FFFFFF", ...typography.title },
});
