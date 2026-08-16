import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

export default function PaymentHistoryScreen({ navigation }: any) {
  useScreenView("PaymentHistoryScreen");
  const { t } = useTranslation();
  const [payments, setPayments] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.getMyProfile().then(setProfile).catch(() => {});
  }, []);

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    api.getPaymentHistory().then(setPayments).catch(() => setError(true)).finally(() => { setLoading(false); setRefreshing(false); });
  }

  useFocusEffect(useCallback(load, []));

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>{t("payment.historyTitle")}</Text>
      {loading ? (
        <SkeletonList />
      ) : error ? (
        <ErrorState message={t("payment.couldntLoadHistory")} onRetry={load} />
      ) : (
      <FlatList
        style={{ flex: 1 }}
        data={payments}
        maxToRenderPerBatch={10}
        windowSize={8}
        initialNumToRender={10}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate("PaymentDetail", { booking: item })}
          >
            {/* flex: 1 + numberOfLines is what's missing here — without it,
                a long source/dest address has nothing to shrink or wrap
                against inside this row, so the row's total width grows
                past the screen edge instead of truncating, pushing the
                amount/status column (and sometimes itself) off-screen. */}
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={styles.route} numberOfLines={1}>{item.ride?.sourceAddress} to {item.ride?.destAddress}</Text>
              <Text style={styles.date}>{item.platformFeePaidAt ? new Date(item.platformFeePaidAt).toLocaleDateString() : "—"}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.amount}>{item.platformFeeAmount != null ? `Rs ${Number(item.platformFeeAmount)}` : "—"}</Text>
              <Text style={[styles.status, item.platformFeePaidAt ? styles.statusPaid : styles.statusPending]}>
                {item.platformFeePaidAt ? t("payment.paid") : t("payment.pendingLabel")}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title={t("payment.noPaymentsYet")} subtitle={t("payment.completedTripsShowHere")} />}
      />
      )}
      <AppBottomNav navigation={navigation} profile={profile} active="menu" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  route: { ...typography.title, fontSize: 13 },
  date: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  amount: typography.body,
  status: { ...typography.small, marginTop: 2 },
  statusPaid: { color: colors.success },
  statusPending: { color: colors.warning },
  empty: { textAlign: "center", marginTop: spacing.xl, color: colors.textMuted },
});
