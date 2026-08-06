import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";

// Web build of LiveTrackingScreen — react-native-maps is a native-only
// module (it imports RN's codegen internals directly), so importing it
// breaks the entire web bundle, not just this screen. Metro/Expo picks
// this .web.tsx file automatically when bundling for web and falls back
// to a plain coordinates readout instead of a real map. Everything else
// (polling, SOS hold-to-confirm, trip completion) is unchanged from the
// native version.

const STALE_THRESHOLD_MS = 90 * 1000;
const SOS_HOLD_MS = 3000;

export default function LiveTrackingScreen({ route, navigation }: any) {
  const { bookingId, role } = route.params; // role: "DRIVER" | "PASSENGER"
  const [lastLocationAt, setLastLocationAt] = useState<string | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigatedToPayment = useRef(false);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const track = await api.trackTrip(bookingId);
        setLastLocationAt(track.lastLocationAt);
        if (track.lat && track.lng) setPosition({ lat: track.lat, lng: track.lng });

        if (
          role === "PASSENGER" &&
          !navigatedToPayment.current &&
          ["CHARGE_ATTEMPTED", "PAYMENT_PENDING"].includes(track.status)
        ) {
          navigatedToPayment.current = true;
          navigation.replace("Payment", { bookingId, amount: track.amount });
        }
      } catch {
        // swallow — the stale-state UI below already communicates the gap
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [bookingId, role]);

  const isStale =
    !lastLocationAt || Date.now() - new Date(lastLocationAt).getTime() > STALE_THRESHOLD_MS;

  function startHold() {
    setHolding(true);
    holdTimer.current = setTimeout(async () => {
      setHolding(false);
      try {
        const loc = position || { lat: 12.9352, lng: 77.6146 };
        await api.triggerSos(bookingId, loc);
        Analytics.sosTriggered(bookingId);
        showAlert("Help is on the way", "Your emergency contact has been notified.");
      } catch (err: any) {
        showAlert("Couldn't send SOS", err.message);
      }
    }, SOS_HOLD_MS);
  }

  function cancelHold() {
    setHolding(false);
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }

  function handleCompleteTrip() {
    navigation.navigate("CompleteTripConfirmation", { bookingId });
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.mapArea}>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>
            {position
              ? `Last known position: ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`
              : "Waiting for location..."}
          </Text>
          <Text style={styles.mapPlaceholderHint}>Live map view isn't available on web — open this in the mobile app.</Text>
        </View>
        <View style={styles.etaBadge}>
          <Text style={styles.etaText}>{isStale ? "Reconnecting..." : "ETA 18 min"}</Text>
        </View>
      </View>

      <View style={styles.statusBar}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <View>
          <Text style={styles.statusTitle}>Trip in progress</Text>
          <Text style={styles.statusSub}>
            {isStale ? "Last known location a moment ago" : "En route"}
          </Text>
        </View>
      </View>

      <View style={styles.bottomBar}>
        {role !== "DRIVER" && (
          <View style={styles.driverRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>D</Text>
            </View>
            <Text style={styles.driverName}>Your driver</Text>
          </View>
        )}

        {role === "DRIVER" && (
          <Pressable style={styles.completeButton} onPress={handleCompleteTrip}>
            <Text style={styles.completeButtonText}>Complete trip</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.sosButton, holding && styles.sosButtonHolding]}
          onPressIn={startHold}
          onPressOut={cancelHold}
        >
          <Text style={styles.sosText}>
            {holding ? "Keep holding..." : "SOS · hold for help"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  mapArea: { height: 260, backgroundColor: colors.accentBg, justifyContent: "flex-start" },
  mapPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  mapPlaceholderText: { ...typography.body, color: colors.accentText, textAlign: "center" },
  mapPlaceholderHint: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
  etaBadge: {
    margin: spacing.md,
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  etaText: { ...typography.caption, color: colors.accentText },
  statusBar: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  back: { fontSize: 18 },
  statusTitle: typography.title,
  statusSub: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  bottomBar: { flex: 1, padding: spacing.md, justifyContent: "flex-end", gap: spacing.md },
  driverRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.accentText, fontSize: 11, fontWeight: "500" },
  driverName: typography.caption,
  completeButton: {
    backgroundColor: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  completeButtonText: { color: "#FFFFFF", ...typography.title },
  sosButton: {
    backgroundColor: colors.dangerBg,
    height: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  sosButtonHolding: { backgroundColor: colors.danger },
  sosText: { color: colors.danger, ...typography.title, fontSize: 13 },
});
