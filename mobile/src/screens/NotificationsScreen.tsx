import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { SafeAreaView } from "react-native-safe-area-context";

type Notif = { id: string; title: string; body: string; read: boolean; createdAt: string };

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    api.getNotifications().then(setNotifications).catch(() => setError(true)).finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(load, []);

  async function markRead(id: string) {
    await api.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
      </View>
      {loading ? (
        <SkeletonList count={4} />
      ) : error ? (
        <ErrorState message="Couldn't load notifications." onRetry={load} />
      ) : (
      <FlatList
        data={notifications}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, !item.read && styles.cardUnread]}
            onPress={() => markRead(item.id)}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState title="No notifications yet" />}
      />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  back: { fontSize: 18 },
  title: typography.title,
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  cardUnread: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  cardTitle: { ...typography.title, fontSize: 13 },
  cardBody: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  empty: { textAlign: "center", marginTop: spacing.xl, color: colors.textMuted },
});
