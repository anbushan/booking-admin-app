import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import RazorpayCheckout from "react-native-razorpay";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

// Hardcoded true rather than gated on `__DEV__` — that global isn't
// reliably true across every way this app gets previewed (e.g. Expo
// web), and this button is harmless either way: the backend endpoint it
// calls (POST /api/payments/:bookingId/mock-confirm) 404s unless
// ALLOW_MOCK_PAYMENT_CONFIRM=true is set server-side, so that's the real
// gate. Flip this to false once you no longer need to test payments
// without a native Razorpay build.
const SHOW_MOCK_PAYMENT_BUTTON = true;

export default function PaymentScreen({ route, navigation }: any) {
  useScreenView("PaymentScreen");
  const { t } = useTranslation();
  // `description` is what shows in the Razorpay sheet and the header —
  // this screen only ever charges the platform fee now (the remaining
  // fare is settled directly with the driver, never charged in-app), so
  // callers should pass "Platform fee", but default to it too.
  const { bookingId, amount, description = t("payment.platformFeeLabel"), retry } = route.params;
  const [paying, setPaying] = useState(false);
  const [mocking, setMocking] = useState(false);

  async function handlePay() {
    setPaying(true);
    try {
      const order = await (retry ? api.retryPayment(bookingId) : api.chargeBooking(bookingId));

      // Same flow either way — the backend already confirmed the
      // booking outright (see payments.routes.js) when the platform fee
      // computes to zero, since Razorpay won't even accept a ₹0 order.
      // Nothing left to check out; just reflect that it's done.
      if (order.free) {
        Analytics.paymentSuccess(bookingId, 0);
        navigation.replace("History", { role: "PASSENGER" });
        return;
      }

      const result = await RazorpayCheckout.open({
        key: order.keyId,
        amount: order.amount * 100,
        currency: "INR",
        order_id: order.orderId,
        name: "NanbaGO",
        description,
        theme: { color: "#1A1A18" },
      });

      // The Checkout success callback confirms the payment sheet closed
      // cleanly — it is NOT the source of truth that money moved. That's
      // Razorpay's server-side webhook (payments.routes.js), which is
      // what actually flips the booking to CONFIRMED and starts the
      // grace-cancel window. Poll status here just to give the user
      // quick feedback.
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const status = await api.getPaymentStatus(bookingId);
        if (status.status === "CONFIRMED") {
          clearInterval(poll);
          Analytics.paymentSuccess(bookingId, amount);
          navigation.replace("History", { role: "PASSENGER" });
        } else if (attempts > 10) {
          clearInterval(poll);
          showAlert(
            t("payment.paymentReceived"),
            t("payment.confirmingPayment")
          );
          navigation.goBack();
        }
      }, 2000);
    } catch (err: any) {
      // RazorpayCheckout.open rejects on user cancellation too, not just
      // real failures — distinguish so we don't alarm someone who just
      // backed out of the payment sheet.
      if (err?.code === 2 || /cancel/i.test(err?.description || "")) {
        // user cancelled — no alert needed
      } else {
        Analytics.paymentFailed(bookingId);
        showAlert(t("payment.paymentFailed"), err.description || err.message || t("payment.pleaseTryAgain"));
      }
    } finally {
      setPaying(false);
    }
  }

  // Dev-only fallback for Expo Go / web, where the native Razorpay
  // Checkout module isn't available (same constraint as react-native-maps
  // elsewhere in this app) — skips straight to what the real webhook
  // would do, via the same reusable backend logic (see
  // payments.routes.js confirmPlatformFeePayment). Backend 404s this
  // outside NODE_ENV=development, so it's a no-op button in production.
  async function handleMockPay() {
    setMocking(true);
    try {
      await api.mockConfirmPayment(bookingId);
      Analytics.paymentSuccess(bookingId, amount);
      navigation.replace("History", { role: "PASSENGER" });
    } catch (err: any) {
      showAlert(t("payment.couldntSimulate"), err.message);
    } finally {
      setMocking(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={description} onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        {!!retry && (
          <View style={styles.retryNotice}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.retryNoticeText}>{t("payment.retryNotice")}</Text>
          </View>
        )}

        <View style={styles.summary}>
          <View style={styles.row}>
            <Text style={styles.label}>{description}</Text>
            <Text style={[styles.value, amount === 0 && styles.freeValue]}>{amount === 0 ? t("payment.free") : `Rs ${amount}`}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.totalLabel}>{t("payment.totalDue")}</Text>
            <Text style={[styles.totalValue, amount === 0 && styles.freeValue]}>{amount === 0 ? t("payment.free") : `Rs ${amount}`}</Text>
          </View>
        </View>

        <Pressable style={styles.payButton} onPress={handlePay} disabled={paying}>
          <Text style={styles.payButtonText}>
            {paying
              ? t("payment.processing")
              : amount === 0
              ? t("payment.confirmFree")
              : retry
              ? t("payment.retryPaymentAmount", { amount })
              : t("payment.payAmount", { amount })}
          </Text>
        </Pressable>
        <Text style={styles.securedBy}>{t("payment.securedBy")}</Text>

        {SHOW_MOCK_PAYMENT_BUTTON && (
          <Pressable style={styles.mockButton} onPress={handleMockPay} disabled={mocking}>
            <Text style={styles.mockButtonText}>
              {mocking ? t("payment.simulating") : t("payment.simulatePaymentDev")}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: { fontSize: 18 },
  title: typography.title,
  body: { padding: spacing.lg },
  retryNotice: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: colors.dangerBg, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.md },
  retryNoticeText: { ...typography.small, color: colors.danger, flex: 1, lineHeight: 17 },
  summary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { ...typography.caption, color: colors.textSecondary },
  value: typography.body,
  totalLabel: { ...typography.title, fontSize: 14 },
  totalValue: { ...typography.title, fontSize: 14 },
  freeValue: { color: colors.success },
  payButton: {
    backgroundColor: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  payButtonText: { ...typography.title, color: "#FFFFFF" },
  securedBy: { textAlign: "center", ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
  mockButton: {
    borderWidth: 1,
    borderColor: colors.warning,
    height: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  mockButtonText: { ...typography.caption, color: colors.warning, fontWeight: "700", fontFamily: FONT.bold },
});
