import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { CarLoader } from "../components/CarLoader";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";

export default function PaymentHistoryScreen({ navigation }: any) {
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
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>Payment history</Text>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message="Couldn't load payment history." onRetry={load} />
      ) : (
      <FlatList
        style={{ flex: 1 }}
        data={payments}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate("PaymentDetail", { booking: item })}
          >
            <View>
              <Text style={styles.route}>{item.ride?.sourceAddress} to {item.ride?.destAddress}</Text>
              <Text style={styles.date}>{item.platformFeePaidAt ? new Date(item.platformFeePaidAt).toLocaleDateString() : "—"}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.amount}>{item.platformFeeAmount != null ? `Rs ${Number(item.platformFeeAmount)}` : "—"}</Text>
              <Text style={[styles.status, item.platformFeePaidAt ? styles.statusPaid : styles.statusPending]}>
                {item.platformFeePaidAt ? "Paid" : "Pending"}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="No payments yet" subtitle="Completed trips will show up here." />}
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
