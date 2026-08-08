import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Linking, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { primeLocationIfNeeded } from "../lib/locationPriming";
import { Analytics } from "../lib/analytics";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";
import { CarLoader } from "../components/CarLoader";
import { KeyboardAvoider } from "../components/KeyboardAvoider";

export default function StartTripScreen({ route, navigation }: any) {
  const { bookingId } = route.params;
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [arriving, setArriving] = useState(true);
  const [passengerName, setPassengerName] = useState("your passenger");
  const [passengerRating, setPassengerRating] = useState<number | null>(null);
  const [calling, setCalling] = useState(false);
  const { showError } = useToast();

  useEffect(() => {
    // Entering this screen IS "I've arrived" — it generates the pickup
    // code server-side and notifies the passenger, who reads it back to
    // you below. Previously this step was never triggered from anywhere,
    // so the code the driver typed here could never match (nothing had
    // generated one yet).
    api
      .startTrip(bookingId)
      .catch((err: any) => showAlert("Couldn't notify the passenger", err.message))
      .finally(() => setArriving(false));
    api.getBookingDetail(bookingId).then((booking) => {
      if (booking.passenger?.name) setPassengerName(booking.passenger.name);
      if (booking.passenger?.ratingAvg != null) setPassengerRating(booking.passenger.ratingAvg);
    }).catch(() => {});
  }, [bookingId]);

  async function handleStart() {
    setVerifying(true);
    try {
      await api.verifyTripOtp(bookingId, code.trim());
      Analytics.tripStarted(bookingId);
      await primeLocationIfNeeded(navigation, "ActiveTrip", { bookingId, role: "DRIVER" });
    } catch (err: any) {
      showAlert("Couldn't start trip", err.message);
    } finally {
      setVerifying(false);
    }
  }

  async function handleCall() {
    setCalling(true);
    try {
      const { proxyNumber } = await api.initiateCall(bookingId, "PASSENGER");
      await Linking.openURL(`tel:${proxyNumber}`);
    } catch (err: any) {
      showError(err.message || "Couldn't start the call");
    } finally {
      setCalling(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoider style={styles.centerContent}>
        {arriving ? (
          <View style={styles.arrivingCard}>
            <CarLoader size="md" />
            <Text style={styles.arrivingText}>Letting {passengerName} know you've arrived...</Text>
          </View>
        ) : (
          <>
            <View style={styles.brandIcon}>
              <Ionicons name="key-outline" size={24} color={colors.accentText} />
            </View>
            <Text style={styles.title}>Verify pickup</Text>
            <Text style={styles.subtitle}>Ask {passengerName} to read out their code, or type their Booking ID</Text>

            <View style={styles.inputWrap}>
              <Ionicons name="keypad-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="OTP or Booking ID"
                placeholderTextColor={colors.textMuted}
                value={code}
                onChangeText={setCode}
                autoFocus
              />
            </View>

            <View style={styles.passengerBar}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{passengerName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.passengerName}>{passengerName}</Text>
                {passengerRating != null && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={11} color={colors.warning} />
                    <Text style={styles.passengerMeta}>{passengerRating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
              <Pressable style={styles.callButton} onPress={handleCall} disabled={calling} hitSlop={4}>
                <Ionicons name="call-outline" size={17} color={colors.accentText} />
              </Pressable>
            </View>

            <Pressable style={styles.button} onPress={handleStart} disabled={verifying || code.trim().length < 4}>
              {!verifying && <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
              <Text style={styles.buttonText}>{verifying ? "Starting..." : "Start trip"}</Text>
            </Pressable>
          </>
        )}
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centerContent: { flex: 1, padding: spacing.lg, justifyContent: "center", alignItems: "center" },
  arrivingCard: { alignItems: "center", gap: spacing.md },
  arrivingText: { ...typography.title, textAlign: "center" },
  brandIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentBg,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  title: { ...typography.title, fontSize: 18, textAlign: "center" },
  subtitle: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: 4, marginBottom: spacing.lg, lineHeight: 18, maxWidth: 280 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, width: "100%",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, height: 50, paddingHorizontal: spacing.md, marginBottom: spacing.md,
  },
  input: { flex: 1, ...typography.body, letterSpacing: 1, color: colors.textPrimary },
  passengerBar: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, width: "100%",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.accentText, fontWeight: "600", fontSize: 15 },
  passengerName: { ...typography.body, fontWeight: "500" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  passengerMeta: { ...typography.small, color: colors.textMuted },
  callButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  button: {
    flexDirection: "row", gap: spacing.xs,
    backgroundColor: colors.textPrimary, height: 48, borderRadius: radius.sm,
    alignItems: "center", justifyContent: "center", width: "100%",
  },
  buttonText: { color: "#FFFFFF", ...typography.title },
});
