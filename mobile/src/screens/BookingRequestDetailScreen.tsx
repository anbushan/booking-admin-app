import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { StepTracker, bookingJourneySteps } from "../components/StepTracker";
import { SafeAreaView } from "react-native-safe-area-context";

export default function BookingRequestDetailScreen({ route, navigation }: any) {
  const { request } = route.params;
  const [responding, setResponding] = useState(false);

  async function respond(action: "accept" | "reject") {
    setResponding(true);
    try {
      if (action === "accept") await api.acceptBooking(request.id);
      else await api.rejectBooking(request.id);
      navigation.goBack();
    } catch (err: any) {
      showAlert("Couldn't update booking", err.message);
    } finally {
      setResponding(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>Booking request</Text>

      <View style={styles.body}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(request.passenger?.name || "?")[0]}</Text>
          </View>
          <View>
            <Text style={styles.name}>{request.passenger?.name || "Passenger"}</Text>
            <Text style={styles.meta}>
              <Ionicons name="star" size={11} color={colors.marigold} /> {(request.passenger?.ratingAvg ?? 0).toFixed(1)} rating
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoLabelRow}>
            <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>Seats requested</Text>
          </View>
          <Text style={styles.infoValue}>{request.seatsBooked}</Text>
        </View>
        <View style={styles.infoRow}>
          <View style={styles.infoLabelRow}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>Pickup point</Text>
          </View>
          <Text style={styles.infoValue}>
            {request.isCustomPickup ? request.pickupAddress : "Default pickup point"}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>What happens next</Text>
        <View style={styles.trackerCard}>
          <StepTracker steps={bookingJourneySteps("BOOKED")} />
        </View>

        <Pressable
          style={styles.acceptButton}
          onPress={() => respond("accept")}
          disabled={responding}
        >
          {!responding && <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
          <Text style={styles.acceptButtonText}>{responding ? "..." : "Accept booking"}</Text>
        </Pressable>
        <Pressable
          style={styles.declineButton}
          onPress={() => respond("reject")}
          disabled={responding}
        >
          <Ionicons name="close-circle-outline" size={15} color={colors.danger} />
          <Text style={styles.declineButtonText}>Decline</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg },
  profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: colors.accentText },
  name: { ...typography.title, fontSize: 15 },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoLabel: { ...typography.caption, color: colors.textSecondary },
  infoValue: typography.body,
  sectionLabel: { ...typography.title, fontSize: 13, marginTop: spacing.lg, marginBottom: spacing.sm },
  trackerCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  acceptButton: { flexDirection: "row", gap: spacing.xs, backgroundColor: colors.accent, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  acceptButtonText: { color: "#FFFFFF", ...typography.title },
  declineButton: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", marginTop: spacing.md, paddingVertical: spacing.xs },
  declineButtonText: { ...typography.caption, color: colors.danger, fontWeight: "700" },
});
