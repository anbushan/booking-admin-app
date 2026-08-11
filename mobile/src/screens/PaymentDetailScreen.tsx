import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { colors, spacing, radius, typography } from "../theme/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

export default function PaymentDetailScreen({ route, navigation }: any) {
  useScreenView("PaymentDetailScreen");
  const { t } = useTranslation();
  const { booking } = route.params;
  const platformFee = booking.platformFeeAmount != null ? Number(booking.platformFeeAmount) : null;
  const remainingFare = booking.remainingFareAmount != null ? Number(booking.remainingFareAmount) : null;
  const isPaid = !!booking.platformFeePaidAt;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("payment.receipt")} onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.route}>{t("common.routeTo", { source: booking.ride?.sourceAddress, dest: booking.ride?.destAddress })}</Text>
          <Text style={styles.date}>
            {booking.tripCompletedAt ? new Date(booking.tripCompletedAt).toLocaleString() : "—"}
          </Text>

          <View style={styles.row}>
            <Text style={styles.label}>{t("searchOptions.seats")}</Text>
            <Text style={styles.value}>{booking.seatsBooked}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.totalLabel}>{t("payment.platformFeePaidInApp")}</Text>
            <Text style={styles.totalValue}>{platformFee != null ? `Rs ${platformFee}` : "—"}</Text>
          </View>
          {remainingFare != null && (
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.label}>{t("payment.remainingFareCashUpi")}</Text>
              <Text style={styles.value}>Rs {remainingFare}</Text>
            </View>
          )}

          <Text style={[styles.statusTag, isPaid ? styles.paid : styles.pending]}>
            {isPaid ? t("payment.feePaid") : booking.status}
          </Text>
        </View>

        {booking.refund && (
          <Pressable
            style={styles.refundLink}
            onPress={() => navigation.navigate("RefundStatus", { refund: booking.refund })}
          >
            <Text style={styles.refundLinkText}>{t("payment.viewRefundStatus")}</Text>
          </Pressable>
        )}
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
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  route: { ...typography.title, fontSize: 14 },
  date: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { ...typography.caption, color: colors.textSecondary },
  value: typography.body,
  totalLabel: { ...typography.title, fontSize: 14 },
  totalValue: { ...typography.title, fontSize: 14 },
  statusTag: { alignSelf: "flex-start", ...typography.small, marginTop: spacing.md, padding: 6, borderRadius: 6 },
  paid: { color: colors.success, backgroundColor: colors.successBg },
  pending: { color: colors.warning, backgroundColor: colors.warningBg },
  refundLink: { marginTop: spacing.lg, alignItems: "center" },
  refundLinkText: { ...typography.body, color: colors.accentText },
});
