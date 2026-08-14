import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { StepTracker, bookingJourneySteps } from "../components/StepTracker";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import Avatar from "../components/Avatar";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { useTranslation } from "../lib/i18n/I18nContext";

export default function BookingRequestDetailScreen({ route, navigation }: any) {
  useScreenView("BookingRequestDetailScreen");
  const { t } = useTranslation();
  const { request } = route.params;
  const [responding, setResponding] = useState(false);

  async function respond(action: "accept" | "reject") {
    setResponding(true);
    try {
      if (action === "accept") await api.acceptBooking(request.id);
      else await api.rejectBooking(request.id);
      navigation.goBack();
    } catch (err: any) {
      showAlert(t("bookingRequests.couldntUpdate"), err.message);
    } finally {
      setResponding(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("bookingRequestDetail.title")} onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <View style={styles.profileRow}>
          <Avatar uri={request.passenger?.photoViewUrl} name={request.passenger?.name} size={44} />
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{request.passenger?.name || t("register.passenger")}</Text>
              <VerifiedBadge verified={!!request.passenger?.passengerVerified} size="sm" label={request.passenger?.passengerVerified ? t("verification.idVerifiedLabel") : t("verification.idUnverifiedLabel")} />
            </View>
            <Text style={styles.meta}>
              <Ionicons name="star" size={11} color={colors.marigold} /> {t("publicProfile.rating", { rating: (request.passenger?.ratingAvg ?? 0).toFixed(1) })}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoLabelRow}>
            <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>{t("bookingRequestDetail.seatsRequested")}</Text>
          </View>
          <Text style={styles.infoValue}>{request.seatsBooked}</Text>
        </View>
        <View style={styles.infoRow}>
          <View style={styles.infoLabelRow}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>{t("bookingRequestDetail.pickupPoint")}</Text>
          </View>
          <Text style={styles.infoValue}>
            {request.isCustomPickup ? request.pickupAddress : t("bookingRequests.defaultPickup")}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>{t("bookingRequestDetail.whatHappensNext")}</Text>
        <View style={styles.trackerCard}>
          <StepTracker steps={bookingJourneySteps("BOOKED", t)} />
        </View>

        <Pressable
          style={styles.acceptButton}
          onPress={() => respond("accept")}
          disabled={responding}
        >
          {!responding && <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
          <Text style={styles.acceptButtonText}>{responding ? "..." : t("bookingRequestDetail.acceptBooking")}</Text>
        </Pressable>
        <Pressable
          style={styles.declineButton}
          onPress={() => respond("reject")}
          disabled={responding}
        >
          <Ionicons name="close-circle-outline" size={15} color={colors.danger} />
          <Text style={styles.declineButtonText}>{t("driver.declineBooking")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg },
  profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { ...typography.title, fontSize: 15 },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoLabel: { ...typography.caption, color: colors.textSecondary },
  infoValue: typography.body,
  sectionLabel: { ...typography.title, fontSize: 13, marginTop: spacing.lg, marginBottom: spacing.sm },
  trackerCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  acceptButton: { flexDirection: "row", gap: spacing.xs, backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  acceptButtonText: { ...typography.title, color: "#FFFFFF" },
  declineButton: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", marginTop: spacing.md, paddingVertical: spacing.xs },
  declineButtonText: { ...typography.caption, color: colors.danger, fontWeight: "700", fontFamily: FONT.bold },
});
