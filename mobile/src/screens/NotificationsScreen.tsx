import React, { useState, useCallback, useMemo } from "react";
import { View, Text, SectionList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { CarLoader } from "../components/CarLoader";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";
import { resolveNotificationTarget } from "../lib/notificationTargets";
import { useScreenView } from "../lib/useScreenView";

type Notif = { id: string; type: string; title: string; body: string; bookingId: string | null; read: boolean; createdAt: string };

// One glyph per notification family so the list reads at a glance,
// same idea as the driver action rows on Home — a word takes a beat to
// read, an icon+color reads instantly.
function notifIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === "NEW_BOOKING_REQUEST") return "mail-unread-outline";
  if (type === "DRIVER_ARRIVED") return "location-outline";
  if (type === "PAYMENT_PENDING" || type === "PAYMENT_FAILED") return "card-outline";
  if (type === "BOOKING_ACCEPTED" || type === "BOOKING_CONFIRMED") return "checkmark-circle-outline";
  if (type === "BOOKING_REJECTED" || type === "BOOKING_CANCELLED") return "close-circle-outline";
  if (type === "TRIP_COMPLETED") return "flag-outline";
  if (type === "NEW_MESSAGE") return "chatbubble-ellipses-outline";
  if (type === "PROMOTION") return "megaphone-outline";
  return "notifications-outline";
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Today / yesterday / earlier, the same grouping every notification
// feed uses — the raw list read as an undifferentiated wall of cards
// with no sense of "is this new or from last week".
function groupByDate(notifications: Notif[]) {
  const today: Notif[] = [];
  const yesterday: Notif[] = [];
  const earlier: Notif[] = [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  for (const n of notifications) {
    const t = new Date(n.createdAt).getTime();
    if (t >= startOfToday) today.push(n);
    else if (t >= startOfYesterday) yesterday.push(n);
    else earlier.push(n);
  }
  return [
    { title: "Today", data: today },
    { title: "Yesterday", data: yesterday },
    { title: "Earlier", data: earlier },
  ].filter((s) => s.data.length > 0);
}

export default function NotificationsScreen({ navigation }: any) {
  useScreenView("NotificationsScreen");
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    api.getNotifications().then(setNotifications).catch(() => setError(true)).finally(() => { setLoading(false); setRefreshing(false); });
  }

  useFocusEffect(useCallback(load, []));
  useFocusEffect(useCallback(() => { api.getMyProfile().then(setProfile).catch(() => {}); }, []));

  const unreadCount = notifications.filter((n) => !n.read).length;
  const sections = useMemo(() => groupByDate(notifications), [notifications]);

  async function markRead(id: string) {
    await api.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await Promise.all(unread.map((n) => api.markNotificationRead(n.id)));
    } finally {
      setMarkingAll(false);
    }
  }

  function handlePress(notif: Notif) {
    markRead(notif.id);
    const target = resolveNotificationTarget(notif.type, notif.bookingId, profile?.role);
    if (target) navigation.navigate(target.screen, target.params);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.pageTitle}>Notifications</Text>
          {unreadCount > 0 && <Text style={styles.pageSubtitle}>{unreadCount} unread</Text>}
        </View>
        {unreadCount > 0 && (
          <Pressable style={styles.markAllButton} onPress={markAllRead} disabled={markingAll} hitSlop={4}>
            <Ionicons name="checkmark-done-outline" size={14} color={colors.accentText} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message="Couldn't load notifications." onRetry={load} />
      ) : (
      <SectionList
        style={{ flex: 1 }}
        sections={sections}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, !item.read && styles.cardUnread]}
            onPress={() => handlePress(item)}
          >
            <View style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}>
              <Ionicons name={notifIcon(item.type)} size={17} color={item.read ? colors.textMuted : colors.accentText} />
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.cardTime}>{relativeTime(item.createdAt)}</Text>
              </View>
              <Text style={styles.cardText}>{item.body}</Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState icon="notifications-outline" title="No notifications yet" subtitle="Booking updates, payment alerts, and trip events will show up here." />
        }
      />
      )}
      <AppBottomNav navigation={navigation} profile={profile} active="menu" unreadCountOverride={unreadCount} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: spacing.lg, paddingBottom: spacing.sm },
  pageTitle: { ...typography.title },
  pageSubtitle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  markAllButton: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  markAllText: { ...typography.small, color: colors.accentText, fontWeight: "700" },
  sectionHeader: { ...typography.small, color: colors.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.sm, marginBottom: spacing.xs },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardUnread: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  iconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  iconWrapUnread: { backgroundColor: colors.surface },
  cardBody: { flex: 1 },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  cardTitle: { ...typography.title, fontSize: 13, flex: 1 },
  cardTime: { ...typography.small, color: colors.textMuted, fontSize: 10.5 },
  cardText: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 4, flexShrink: 0 },
});
