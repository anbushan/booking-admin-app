import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

export default function CompleteTripConfirmationScreen({ route, navigation }: any) {
  useScreenView("CompleteTripConfirmationScreen");
  const { t } = useTranslation();
  // rideId is optional — absent whenever this screen is reached some way
  // that predates segment-aware booking existing; that case keeps the
  // exact old behavior (reset straight to Earnings) below.
  const { bookingId, rideId } = route.params;
  const [completing, setCompleting] = useState(false);

  async function handleConfirm() {
    setCompleting(true);
    try {
      await api.completeTrip(bookingId);
      Analytics.tripCompleted(bookingId);

      // Other passengers can still be mid-trip or waiting to be picked
      // up on this same ride (see backend lib/segments.js) — dropping
      // just-this-one off shouldn't kick the driver out to Earnings and
      // lose their place in the manifest. Only reset there once nobody
      // else on the ride still needs anything from the driver.
      if (rideId) {
        const { stops } = await api.getTripManifest(rideId).catch(() => ({ stops: [] as any[] }));
        const next = stops.find((s: any) => s.id !== bookingId && s.action !== "COMPLETED");
        if (next) {
          // reset(), not replace() — this screen was reached via
          // navigate() from LiveTracking (ActiveTrip) for the
          // just-completed booking, which is still sitting underneath in
          // the stack with stale controls for a trip that's now done.
          // Same reasoning as the Earnings reset below, just landing
          // somewhere other than Earnings when there's still work left.
          navigation.reset({ index: 0, routes: [{ name: "ActiveTrip", params: { bookingId: next.id, role: "DRIVER" } }] });
          return;
        }
      }

      // replace() only swaps this screen — LiveTracking (ActiveTrip),
      // which navigated here via navigate() rather than replace(), was
      // still sitting underneath in the stack with its "Complete trip"/
      // "Stop ride"/SOS controls all still live. Going back from Earnings
      // landed right back on that now-stale live-trip screen for an
      // already-completed trip. reset() clears the whole stack instead.
      navigation.reset({ index: 0, routes: [{ name: "Earnings" }] });
    } catch (err: any) {
      showAlert(t("completeTrip.couldntComplete"), err.message);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>{"\u2713"}</Text>
        </View>
        <Text style={styles.title}>{t("completeTrip.title")}</Text>
        <Text style={styles.description}>{t("completeTrip.description")}</Text>

        <Pressable style={styles.confirmButton} onPress={handleConfirm} disabled={completing}>
          <Text style={styles.confirmButtonText}>
            {completing ? t("completeTrip.completing") : t("liveTracking.completeTrip")}
          </Text>
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>{t("completeTrip.notYet")}</Text>
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
  title: { ...typography.titleCompact, textAlign: "center" },
  description: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, lineHeight: 20 },
  confirmButton: { backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.xl, alignSelf: "stretch" },
  confirmButtonText: { ...typography.title, color: "#FFFFFF" },
  cancelButton: { marginTop: spacing.md },
  cancelButtonText: { ...typography.caption, color: colors.textMuted },
});
