import React, { useEffect, useRef, useState } from "react";
import { View, Text, Linking, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { primeLocationIfNeeded } from "../lib/locationPriming";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";

const OTP_LENGTH = 4;

export default function TripOtpScreen({ route, navigation }: any) {
  const { bookingId } = route.params;
  const [otp, setOtp] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("your driver");
  const [driverRating, setDriverRating] = useState<number | null>(null);
  const [routeLabel, setRouteLabel] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);
  const navigatedAway = useRef(false);
  const { showError } = useToast();

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

  // No more manual "Track this trip" button — the moment the driver
  // actually verifies the code on their end (booking flips to
  // IN_PROGRESS), this screen jumps straight to live tracking on its
  // own. Polling rather than waiting for a push notification keeps this
  // working even if notification permission was denied.
  useEffect(() => {
    const poll = setInterval(async () => {
      if (navigatedAway.current) return;
      try {
        const track = await api.trackTrip(bookingId);
        if (track.status === "IN_PROGRESS") {
          navigatedAway.current = true;
          clearInterval(poll);
          primeLocationIfNeeded(navigation, "LiveTracking", { bookingId, role: "PASSENGER" });
        }
      } catch {
        // swallow — a missed poll just tries again in 3s
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [bookingId]);

  async function handleCall() {
    setCalling(true);
    try {
      const { proxyNumber } = await api.initiateCall(bookingId, "DRIVER");
      await Linking.openURL(`tel:${proxyNumber}`);
    } catch (err: any) {
      showError(err.message || "Couldn't start the call");
    } finally {
      setCalling(false);
    }
  }

  const digits = (otp || "").padEnd(OTP_LENGTH, " ").slice(0, OTP_LENGTH).split("");

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title="Your driver has arrived" onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <View style={styles.codeCard}>
          <Text style={styles.instruction}>Share this code with {driverName}</Text>
          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <View key={i} style={styles.otpBox}>
                <Text style={styles.otpDigit}>{otp ? d : ""}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="shield-checkmark-outline" size={15} color={colors.textMuted} />
          <Text style={styles.hint}>Confirms it's your ride — only share it once the driver asks</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
          <Text style={styles.altHint}>Trouble with the code? Your driver can also start the trip with your Booking ID: {bookingId}</Text>
        </View>
        {routeLabel && (
          <View style={styles.infoRow}>
            <Ionicons name="navigate-outline" size={15} color={colors.textMuted} />
            <Text style={styles.routeLabel}>{routeLabel}</Text>
          </View>
        )}
      </View>

      <View style={styles.driverBar}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{driverName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.driverName}>{driverName}</Text>
          {driverRating != null && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={11} color={colors.warning} />
              <Text style={styles.driverMeta}>{driverRating.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <Pressable style={styles.iconButton} onPress={handleCall} disabled={calling} hitSlop={4}>
          <Ionicons name="call-outline" size={17} color={colors.accentText} />
        </Pressable>
        <Pressable
          style={styles.iconButton}
          onPress={() => navigation.navigate("ChatDetail", { bookingId, calleeRole: "DRIVER" })}
          hitSlop={4}
        >
          <Ionicons name="chatbubble-outline" size={17} color={colors.accentText} />
        </Pressable>
      </View>

      <View style={styles.waitingRow}>
        <Ionicons name="time-outline" size={15} color={colors.textMuted} />
        <Text style={styles.waitingText}>You'll be taken to live tracking as soon as the trip starts</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  codeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
  },
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
  otpDigit: { fontSize: 28, fontWeight: "700", color: colors.accentText },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: spacing.md, maxWidth: 300 },
  hint: { ...typography.small, color: colors.textMuted, flex: 1 },
  altHint: { ...typography.small, color: colors.textMuted, flex: 1 },
  routeLabel: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  driverBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.accentText, fontWeight: "700", fontSize: 16 },
  driverName: { ...typography.body, fontWeight: "700" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  driverMeta: { ...typography.small, color: colors.textMuted },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  waitingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, margin: spacing.lg, marginTop: spacing.sm },
  waitingText: { ...typography.small, color: colors.textMuted, textAlign: "center", flexShrink: 1 },
});
