import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CompleteTripConfirmationScreen({ route, navigation }: any) {
  const { bookingId } = route.params;
  const [completing, setCompleting] = useState(false);

  async function handleConfirm() {
    setCompleting(true);
    try {
      await api.completeTrip(bookingId);
      Analytics.tripCompleted(bookingId);
      // replace() only swaps this screen — LiveTracking (ActiveTrip),
      // which navigated here via navigate() rather than replace(), was
      // still sitting underneath in the stack with its "Complete trip"/
      // "Stop ride"/SOS controls all still live. Going back from Earnings
      // landed right back on that now-stale live-trip screen for an
      // already-completed trip. reset() clears the whole stack instead.
      navigation.reset({ index: 0, routes: [{ name: "Earnings" }] });
    } catch (err: any) {
      showAlert("Couldn't complete trip", err.message);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>{"\u2713"}</Text>
        </View>
        <Text style={styles.title}>Complete this trip?</Text>
        <Text style={styles.description}>
          This ends the trip. The passenger already paid the platform fee
          in-app — collect the remaining fare directly (cash/UPI) and
          confirm it from your Earnings screen. Make sure you've reached
          the drop-off point before confirming.
        </Text>

        <Pressable style={styles.confirmButton} onPress={handleConfirm} disabled={completing}>
          <Text style={styles.confirmButtonText}>
            {completing ? "Completing..." : "Complete trip"}
          </Text>
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Not yet</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: "center" },
  body: { padding: spacing.xl, alignItems: "center" },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  iconText: { fontSize: 28, color: colors.success },
  title: { ...typography.title, fontSize: 18, textAlign: "center" },
  description: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, lineHeight: 20 },
  confirmButton: { backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.xl, alignSelf: "stretch" },
  confirmButtonText: { color: "#FFFFFF", ...typography.title },
  cancelButton: { marginTop: spacing.md },
  cancelButtonText: { ...typography.caption, color: colors.textMuted },
});
