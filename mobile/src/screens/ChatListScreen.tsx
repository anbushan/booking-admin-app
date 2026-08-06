import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { SafeAreaView } from "react-native-safe-area-context";

type Conversation = {
  bookingId: string;
  otherPartyName: string;
  routeLabel: string;
  status: string;
};

export default function ChatListScreen({ navigation, route }: any) {
  // Same as History — reachable generically (side menu, deep links) with
  // no params, so fall back to the caller's own profile when needed.
  const { currentUserId: paramUserId, role: paramRole } = route.params || {};
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(paramUserId);
  const [role, setRole] = useState<string | undefined>(paramRole);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (paramUserId && paramRole) return;
    api
      .getMyProfile()
      .then((p) => { setCurrentUserId(p.id); setRole(p.role); })
      .catch(() => setError(true));
  }, []);

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    // A conversation is any booking with an active-ish status — driver
    // and passenger only need to talk once a booking exists.
    if (role === "DRIVER") {
      api
        .getDriverActiveBookings()
        .then((items: any[]) =>
          setConversations(
            items.map((b) => ({
              bookingId: b.id,
              otherPartyName: b.passenger?.name || "Passenger",
              routeLabel: `${b.ride?.sourceAddress} to ${b.ride?.destAddress}`,
              status: b.status,
            }))
          )
        )
        .catch(() => setError(true))
        .finally(() => { setLoading(false); setRefreshing(false); });
      return;
    }

    api
      .getMyBookings()
      .then((items: any[]) =>
        setConversations(
          items
            .filter((b) => ["CONFIRMED", "IN_PROGRESS", "PAID"].includes(b.status))
            .map((b) => ({
              bookingId: b.id,
              otherPartyName: b.ride?.driver?.name || "Driver",
              routeLabel: `${b.ride?.sourceAddress} to ${b.ride?.destAddress}`,
              status: b.status,
            }))
        )
      )
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => {
    if (role) load();
  }, [role]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>Messages</Text>
      </View>
      {loading ? (
        <SkeletonList count={3} />
      ) : error ? (
        <ErrorState message="Couldn't load conversations." onRetry={load} />
      ) : (
      <FlatList
        data={conversations}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        keyExtractor={(item) => item.bookingId}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              navigation.navigate("ChatDetail", { bookingId: item.bookingId, currentUserId })
            }
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.otherPartyName[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.otherPartyName}</Text>
              <Text style={styles.route}>{item.routeLabel}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No conversations yet"
            subtitle="Conversations appear once you have a confirmed booking."
          />
        }
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.accentText, fontWeight: "500" },
  name: { ...typography.title, fontSize: 14 },
  route: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  empty: { textAlign: "center", marginTop: spacing.xl, color: colors.textMuted, paddingHorizontal: spacing.lg },
});
