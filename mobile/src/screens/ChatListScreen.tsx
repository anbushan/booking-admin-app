import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { CarLoader } from "../components/CarLoader";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";

type Conversation = {
  bookingId: string;
  otherPartyName: string;
  routeLabel: string;
  status: string;
};

// Chat is for pre-trip coordination only — once the platform fee is
// paid (CONFIRMED) and before the trip actually starts. Not before
// (nothing to coordinate yet — the booking might still fall through)
// and not once IN_PROGRESS or later (they're physically together by
// then, or the trip's already over). Messages are hard-deleted
// server-side at both edges of this window, so a conversation outside
// it has nothing left to show anyway — this just keeps it out of the
// list instead of leaving a dead entry.
const ACTIVE_CHAT_STATUSES = ["CONFIRMED"];

export default function ChatListScreen({ navigation, route }: any) {
  useScreenView("ChatListScreen");
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
            items
              .filter((b) => ACTIVE_CHAT_STATUSES.includes(b.status))
              .map((b) => ({
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
            .filter((b) => ACTIVE_CHAT_STATUSES.includes(b.status))
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

  useFocusEffect(
    useCallback(() => {
      if (role) load();
    }, [role])
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title="Messages" onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message="Couldn't load conversations." onRetry={load} />
      ) : (
      <FlatList
        data={conversations}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        keyExtractor={(item) => item.bookingId}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              navigation.navigate("ChatDetail", {
                bookingId: item.bookingId,
                currentUserId,
                calleeRole: role === "DRIVER" ? "PASSENGER" : "DRIVER",
              })
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
            icon="chatbubbles-outline"
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
  avatarText: { color: colors.accentText, fontWeight: "700" },
  name: { ...typography.title, fontSize: 14 },
  route: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  empty: { textAlign: "center", marginTop: spacing.xl, color: colors.textMuted, paddingHorizontal: spacing.lg },
});
