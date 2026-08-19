import React, { useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Linking } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { CarLoader } from "../components/CarLoader";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";
import { formatInr } from "../lib/money";
import { showAlert } from "../lib/alert";

// Google Calendar's "quick add" URL — no API key, no OAuth, no backend
// email infra required (this app has none — see api.ts). It just opens
// a pre-filled Calendar event the user still has to hit Save on, which
// is exactly what "add to calendar" means to a passenger: nobody wants
// an automatic invite silently added to their calendar.
function buildGoogleCalendarUrl(booking: any) {
  const start = new Date(booking.ride.travelDate);
  const durationMinutes = booking.ride.routeDurationMinutes || 60;
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const toUtcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `NanbaGO ride: ${booking.ride.sourceAddress} → ${booking.ride.destAddress}`,
    dates: `${toUtcStamp(start)}/${toUtcStamp(end)}`,
    details: `Booked via NanbaGO.\nDriver: ${booking.ride.driver.name || booking.ride.driver.phone}\nSeats: ${booking.seatsBooked}`,
    location: booking.ride.sourceAddress,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function BookingDetailScreen({ route, navigation }: any) {
  useScreenView("BookingDetailScreen");
  const { t } = useTranslation();
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Only for the "does this account even have an email to gate the
  // calendar link on" check below — not part of the booking fetch
  // itself, and never blocks the screen if it fails to load.
  const [profileEmail, setProfileEmail] = useState<string | null>(null);

  useEffect(() => {
    api.getMyProfile().then((p: any) => setProfileEmail(p?.email || null)).catch(() => {});
  }, []);

  // Refetches every time this screen regains focus, not just on first
  // mount — status/refund/cash-collected fields here can all change
  // while the passenger/driver is elsewhere (chat, live tracking,
  // payment). `loading` only ever gates the very first fetch, so a
  // background refresh on refocus doesn't flash the spinner over
  // content that's already on screen.
  useFocusEffect(
    useCallback(() => {
      api.getBookingDetail(bookingId)
        .then(setBooking)
        .catch(() => setBooking((prev: any) => prev ?? null))
        .finally(() => setLoading(false));
    }, [bookingId])
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.screen, { justifyContent: "center", alignItems: "center" }]} edges={["top", "bottom"]}>
        <CarLoader />
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <EmptyState title={t("bookingDetail.notFound")} />
      </SafeAreaView>
    );
  }

  const amount = Number(booking.segmentPricePerSeat ?? booking.ride.pricePerSeat) * booking.seatsBooked;

  async function handleAddToCalendar() {
    const url = buildGoogleCalendarUrl(booking);
    try {
      await Linking.openURL(url);
    } catch {
      showAlert(t("bookingDetail.couldntOpenCalendar"), t("bookingDetail.couldntOpenCalendarBody"));
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("bookingDetail.title")} onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.route}>{t("common.routeTo", { source: booking.ride.sourceAddress, dest: booking.ride.destAddress })}</Text>
          <Text style={styles.date}>{new Date(booking.ride.travelDate).toLocaleString()}</Text>
        </View>

        <Text style={styles.sectionLabel}>{t("bookingDetail.peopleSection")}</Text>
        <View style={styles.card}>
          {/* Names link through to the public profile — every other list
              in the app that shows a driver/passenger already does this;
              this screen just hadn't caught up. */}
          <Pressable
            style={styles.row}
            disabled={!booking.ride.driver.id}
            onPress={() => navigation.navigate("PublicProfile", { userId: booking.ride.driver.id })}
          >
            <View style={styles.labelRow}>
              <Ionicons name="car-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.label}>{t("register.driver")}</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.value}>{booking.ride.driver.name || booking.ride.driver.phone}</Text>
              <VerifiedBadge verified={!!booking.ride.driverVerified} size="sm" />
              {!!booking.ride.driver.id && <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
            </View>
          </Pressable>
          <Pressable
            style={[styles.row, { borderBottomWidth: 0 }]}
            disabled={!booking.passenger.id}
            onPress={() => navigation.navigate("PublicProfile", { userId: booking.passenger.id })}
          >
            <View style={styles.labelRow}>
              <Ionicons name="person-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.label}>{t("register.passenger")}</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.value}>{booking.passenger.name || booking.passenger.phone}</Text>
              <VerifiedBadge verified={!!booking.passenger.passengerVerified} size="sm" label={booking.passenger.passengerVerified ? t("verification.idVerifiedLabel") : t("verification.idUnverifiedLabel")} />
              {!!booking.passenger.id && <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
            </View>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>{t("bookingDetail.fareSection")}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <Ionicons name="people-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.label}>{t("searchOptions.seats")}</Text>
            </View>
            <Text style={styles.value}>{booking.seatsBooked}</Text>
          </View>
          <View style={booking.remainingFareAmount != null ? styles.row : [styles.row, { borderBottomWidth: 0 }]}>
            <View style={styles.labelRow}>
              <Ionicons name="cash-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.label}>{t("booking.fare")}</Text>
            </View>
            <Text style={styles.value}>Rs {formatInr(amount)}</Text>
          </View>
          {booking.remainingFareAmount != null && (
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <View style={styles.labelRow}>
                <Ionicons name="wallet-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.label}>{t("bookingDetail.cashUpiDue")}</Text>
              </View>
              <Text style={styles.value}>Rs {formatInr(booking.remainingFareAmount)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionLabel}>{t("bookingDetail.statusLabel")}</Text>
        <View style={[styles.card, styles.statusCard]}>
          <StatusBadge status={booking.status} size="sm" />
        </View>

        {/* Only ever present once the trip's done and the other party
            actually used RateReviewScreen — scoped server-side to
            reviews addressed to whoever's viewing (see bookings.routes.js
            GET /:id), so this never shows your own just-submitted rating
            reflected back at you. */}
        {booking.reviewForMe && (
          <View style={styles.reviewCard}>
            <Text style={styles.reviewTitle}>{t("bookingDetail.feedbackReceived")}</Text>
            <Text style={styles.reviewStars}>
              {"★".repeat(booking.reviewForMe.rating)}{"☆".repeat(5 - booking.reviewForMe.rating)}
            </Text>
            {!!booking.reviewForMe.comment && (
              <Text style={styles.reviewComment}>{booking.reviewForMe.comment}</Text>
            )}
            <Text style={styles.reviewFrom}>{t("bookingDetail.feedbackFrom", { name: booking.reviewForMe.fromUserName })}</Text>
          </View>
        )}

        {/* Gated on the booking actually being confirmed (nothing to put
            on a calendar before that) and on the account having an
            email on file — this app has no email-sending infra at all
            (see api.ts), so this is a client-side "quick add" deep link
            into Google Calendar rather than a real emailed invite; the
            email-on-file check is a reasonable proxy for "this person
            actually uses Calendar/Gmail" without us needing to build
            any of that infra. */}
        {booking.status === "CONFIRMED" && !!profileEmail && (
          <Pressable style={styles.actionButton} onPress={handleAddToCalendar}>
            <View style={styles.calendarButtonRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.accentText} />
              <Text style={styles.actionButtonText}>{t("bookingDetail.addToCalendar")}</Text>
            </View>
          </Pressable>
        )}
        {!!booking.platformFeePaidAt && (
          <Pressable
            style={styles.actionButton}
            onPress={() => navigation.navigate("PaymentDetail", { booking })}
          >
            <Text style={styles.actionButtonText}>{t("bookingDetail.viewReceipt")}</Text>
          </Pressable>
        )}
        {booking.refund && (
          <Pressable
            style={styles.actionButton}
            onPress={() => navigation.navigate("RefundStatus", { refund: booking.refund })}
          >
            <Text style={styles.actionButtonText}>{t("payment.viewRefundStatus")}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  title: typography.title,
  body: { padding: spacing.lg },
  route: { ...typography.title, fontSize: 15 },
  date: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  statusCard: { alignItems: "flex-start" },
  // Same recipe as reviewTitle below — naming this once instead of a
  // 6th one-off caption-with-bold-override.
  sectionLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "700", fontFamily: FONT.bold, marginTop: spacing.lg, marginBottom: spacing.xs },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  labelRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  label: { ...typography.caption, color: colors.textSecondary },
  valueRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  value: typography.body,
  actionButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  actionButtonText: { ...typography.body, color: colors.accentText },
  calendarButtonRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  reviewCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  reviewTitle: { ...typography.caption, color: colors.textSecondary, fontWeight: "700", fontFamily: FONT.bold },
  reviewStars: { color: colors.warning, fontSize: 16, marginTop: spacing.xs },
  reviewComment: { ...typography.body, marginTop: spacing.xs },
  reviewFrom: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
});
