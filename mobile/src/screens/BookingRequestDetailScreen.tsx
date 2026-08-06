import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
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
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>Booking request</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(request.passenger?.name || "?")[0]}</Text>
          </View>
          <View>
            <Text style={styles.name}>{request.passenger?.name || "Passenger"}</Text>
            <Text style={styles.meta}>
              {(request.passenger?.ratingAvg ?? 0).toFixed(1)} rating
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Seats requested</Text>
          <Text style={styles.infoValue}>{request.seatsBooked}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Pickup point</Text>
          <Text style={styles.infoValue}>
            {request.isCustomPickup ? request.pickupAddress : "Default pickup point"}
          </Text>
        </View>

        <Pressable
          style={styles.acceptButton}
          onPress={() => respond("accept")}
          disabled={responding}
        >
          <Text style={styles.acceptButtonText}>{responding ? "..." : "Accept booking"}</Text>
        </Pressable>
        <Pressable
          style={styles.declineButton}
          onPress={() => respond("reject")}
          disabled={responding}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </Pressable>
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
  profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "500", color: colors.accentText },
  name: { ...typography.title, fontSize: 15 },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { ...typography.caption, color: colors.textSecondary },
  infoValue: typography.body,
  acceptButton: { backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  acceptButtonText: { color: "#FFFFFF", ...typography.title },
  declineButton: { alignItems: "center", marginTop: spacing.md },
  declineButtonText: { ...typography.caption, color: colors.danger },
});
