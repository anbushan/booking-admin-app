import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { primeLocationIfNeeded } from "../lib/locationPriming";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";

export default function StartTripScreen({ route, navigation }: any) {
  const { bookingId } = route.params;
  // Either the 4-digit OTP the passenger read aloud, or their Booking ID
  // — either is enough to start the trip, so this isn't restricted to
  // digits/4 characters the way the old OTP-only input was.
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [arriving, setArriving] = useState(true);
  const [passengerName, setPassengerName] = useState("your passenger");

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

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.back}>{"<"}</Text>
      </Pressable>
      <View style={styles.centerContent}>
        {arriving ? (
          <>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.title, { marginTop: spacing.md }]}>Letting {passengerName} know you've arrived...</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Enter {passengerName}'s OTP or Booking ID</Text>
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
            <Pressable style={styles.button} onPress={handleStart} disabled={verifying || code.trim().length < 4}>
              <Text style={styles.buttonText}>{verifying ? "Starting..." : "Start trip"}</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  backButton: { padding: spacing.lg },
  back: { fontSize: 18 },
  centerContent: { flex: 1, padding: spacing.lg, justifyContent: "center", alignItems: "center" },
  title: { ...typography.title, marginBottom: spacing.lg, textAlign: "center" },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    height: 46,
    width: "100%",
    paddingHorizontal: spacing.md,
    textAlign: "center",
    fontSize: 16,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  button: { backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", width: "100%" },
  buttonText: { color: "#FFFFFF", ...typography.title },
});
