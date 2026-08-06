import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { showAlert } from "../lib/alert";
import RazorpayCheckout from "react-native-razorpay";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PaymentScreen({ route, navigation }: any) {
  // `description` is what shows in the Razorpay sheet and the header —
  // this screen only ever charges the platform fee now (the remaining
  // fare is settled directly with the driver, never charged in-app), so
  // callers should pass "Platform fee", but default to it too.
  const { bookingId, amount, description = "Platform fee" } = route.params;
  const [paying, setPaying] = useState(false);

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

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>{description}</Text>
      </View>

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
});
