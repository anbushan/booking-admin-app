import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackButton } from "../components/BackButton";

const STATUS_COPY: Record<string, string> = {
  INITIATED: "Your refund has been initiated.",
  PROCESSING: "Your refund is being processed.",
  COMPLETED: "Your refund has been completed.",
  FAILED: "Something went wrong with this refund — contact support.",
};

export default function RefundStatusScreen({ route, navigation }: any) {
  const { refund } = route.params;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.title}>Refund status</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.amount}>Rs {Number(refund.amount)}</Text>
        <Text style={styles.statusText}>{STATUS_COPY[refund.status] || refund.status}</Text>

        <View style={styles.timeline}>
          <View style={styles.timelineRow}>
            <Text style={styles.timelineLabel}>Initiated</Text>
            <Text style={styles.timelineValue}>{new Date(refund.initiatedAt).toLocaleDateString()}</Text>
          </View>
          <View style={styles.timelineRow}>
            <Text style={styles.timelineLabel}>Estimated by</Text>
            <Text style={styles.timelineValue}>
              {new Date(refund.estimatedCompletionAt).toLocaleDateString()}
            </Text>
          </View>
          {refund.completedAt && (
            <View style={[styles.timelineRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.timelineLabel}>Completed</Text>
              <Text style={styles.timelineValue}>{new Date(refund.completedAt).toLocaleDateString()}</Text>
            </View>
          )}
        </View>

        <Text style={styles.note}>
          Refunds are promised within 3 working days of being initiated,
          though the exact timing can vary by payment method.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  back: { fontSize: 18 },
  title: typography.title,
  body: { padding: spacing.lg, alignItems: "center" },
  amount: { fontSize: 28, fontWeight: "500", marginTop: spacing.lg },
  statusText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, textAlign: "center" },
  timeline: { alignSelf: "stretch", marginTop: spacing.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  timelineRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  timelineLabel: { ...typography.caption, color: colors.textSecondary },
  timelineValue: typography.body,
  note: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.lg },
});
