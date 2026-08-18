import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";
import { formatInr } from "../lib/money";

const STATUS_COPY_KEYS: Record<string, string> = {
  INITIATED: "payment.refundInitiated",
  PROCESSING: "payment.refundProcessing",
  COMPLETED: "payment.refundCompleted",
  FAILED: "payment.refundFailed",
};

export default function RefundStatusScreen({ route, navigation }: any) {
  useScreenView("RefundStatusScreen");
  const { t } = useTranslation();
  const { refund } = route.params;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("payment.refundStatus")} onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <Text style={styles.amount}>Rs {formatInr(refund.amount)}</Text>
        <Text style={styles.statusText}>
          {STATUS_COPY_KEYS[refund.status] ? t(STATUS_COPY_KEYS[refund.status]) : refund.status}
        </Text>

        <View style={styles.timeline}>
          <View style={styles.timelineRow}>
            <Text style={styles.timelineLabel}>{t("payment.initiatedLabel")}</Text>
            <Text style={styles.timelineValue}>{new Date(refund.initiatedAt).toLocaleDateString()}</Text>
          </View>
          <View style={styles.timelineRow}>
            <Text style={styles.timelineLabel}>{t("payment.estimatedBy")}</Text>
            <Text style={styles.timelineValue}>
              {new Date(refund.estimatedCompletionAt).toLocaleDateString()}
            </Text>
          </View>
          {refund.completedAt && (
            <View style={[styles.timelineRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.timelineLabel}>{t("status.completed")}</Text>
              <Text style={styles.timelineValue}>{new Date(refund.completedAt).toLocaleDateString()}</Text>
            </View>
          )}
        </View>

        <Text style={styles.note}>{t("payment.refundNote")}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  title: typography.title,
  body: { padding: spacing.lg, alignItems: "center" },
  amount: { fontSize: 28, fontWeight: "700", fontFamily: FONT.bold, marginTop: spacing.lg },
  statusText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, textAlign: "center" },
  timeline: { alignSelf: "stretch", marginTop: spacing.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  timelineRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  timelineLabel: { ...typography.caption, color: colors.textSecondary },
  timelineValue: typography.body,
  note: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.lg },
});
