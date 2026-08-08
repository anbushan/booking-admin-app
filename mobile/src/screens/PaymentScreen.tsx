import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { showAlert } from "../lib/alert";
import RazorpayCheckout from "react-native-razorpay";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";

// Hardcoded true rather than gated on `__DEV__` — that global isn't
// reliably true across every way this app gets previewed (e.g. Expo
// web), and this button is harmless either way: the backend endpoint it
// calls (POST /api/payments/:bookingId/mock-confirm) 404s outside
// NODE_ENV=development on its own, so that's the real gate. Flip this
// to false once you no longer need to test payments without a native
// Razorpay build.
const SHOW_MOCK_PAYMENT_BUTTON = true;

export default function PaymentScreen({ route, navigation }: any) {
  // `description` is what shows in the Razorpay sheet and the header —
  // this screen only ever charges the platform fee now (the remaining
  // fare is settled directly with the driver, never charged in-app), so
  // callers should pass "Platform fee", but default to it too.
  const { bookingId, amount, description = "Platform fee" } = route.params;
  const [paying, setPaying] = useState(false);
  const [mocking, setMocking] = useState(false);

  async function handlePay() {
    setPaying(true);
    try {
      const order = await api.chargeBooking(bookingId);

      const result = await RazorpayCheckout.open({
        key: order.keyId,
        amount: order.amount * 100,
        currency: "INR",
        order_id: order.orderId,
        name: "Carpool",
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
            "Payment received",
            "We're confirming your payment — check your booking history shortly."
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
        showAlert("Payment failed", err.description || err.message || "Please try again.");
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
      showAlert("Couldn't simulate payment", err.message);
    } finally {
      setMocking(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>{description}</Text>

      <View style={styles.body}>
        <View style={styles.summary}>
          <View style={styles.row}>
            <Text style={styles.label}>{description}</Text>
            <Text style={styles.value}>Rs {amount}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.totalLabel}>Total due</Text>
            <Text style={styles.totalValue}>Rs {amount}</Text>
          </View>
        </View>

        <Pressable style={styles.payButton} onPress={handlePay} disabled={paying}>
          <Text style={styles.payButtonText}>{paying ? "Processing..." : `Pay Rs ${amount}`}</Text>
        </Pressable>
        <Text style={styles.securedBy}>Secured by Razorpay</Text>

        {SHOW_MOCK_PAYMENT_BUTTON && (
          <Pressable style={styles.mockButton} onPress={handleMockPay} disabled={mocking}>
            <Text style={styles.mockButtonText}>
              {mocking ? "Simulating..." : "Simulate payment (dev)"}
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
  summary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { ...typography.caption, color: colors.textSecondary },
  value: typography.body,
  totalLabel: { ...typography.title, fontSize: 14 },
  totalValue: { ...typography.title, fontSize: 14 },
  payButton: {
    backgroundColor: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  payButtonText: { color: "#FFFFFF", ...typography.title },
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
  mockButtonText: { color: colors.warning, ...typography.caption, fontWeight: "500" },
});
