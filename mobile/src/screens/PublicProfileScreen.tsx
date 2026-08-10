import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";

export default function PublicProfileScreen({ route, navigation }: any) {
  useScreenView("PublicProfileScreen");
  const { userId } = route.params;
  const [profile, setProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    api.getPublicProfile(userId).then(setProfile).catch(() => setProfile(null));
    api.getReviewsForUser(userId).then(setReviews).catch(() => setReviews([]));
  }, [userId]);

  if (!profile) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <BackHeader title="Profile" onBack={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title="Profile" onBack={() => navigation.goBack()} />

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile.name || "?")[0]}</Text>
        </View>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.meta}>{profile.role === "DRIVER" ? "Driver" : "Passenger"}</Text>
        {profile.ratingAvg && (
          <Text style={styles.rating}>{profile.ratingAvg.toFixed(1)} rating</Text>
        )}
        <Text style={styles.since}>
          Member since {new Date(profile.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Reviews</Text>
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => {
          // Don't bother linking a review back to the profile you're
          // already looking at \u2014 only reachable if this person reviewed
          // someone who, in turn, reviewed them back.
          const canOpen = !!item.fromUser?.id && item.fromUser.id !== userId;
          return (
            <Pressable
              style={styles.reviewRow}
              disabled={!canOpen}
              onPress={() => navigation.navigate("PublicProfile", { userId: item.fromUser.id })}
            >
              <Text style={styles.reviewStars}>{"\u2605".repeat(item.rating)}</Text>
              {item.comment ? <Text style={styles.reviewComment}>{item.comment}</Text> : null}
              <View style={styles.reviewFromRow}>
                <Text style={styles.reviewFrom}>{item.fromUser?.name || "Rider"}</Text>
                {canOpen && <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No reviews yet.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  back: { fontSize: 18 },
  title: typography.title,
  profileCard: { alignItems: "center", padding: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontWeight: "700", color: colors.accentText },
  name: { ...typography.title, fontSize: 16, marginTop: spacing.sm },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  rating: { ...typography.caption, color: colors.warning, marginTop: 4 },
  since: { ...typography.small, color: colors.textMuted, marginTop: 4 },
  sectionLabel: { ...typography.title, fontSize: 13, marginHorizontal: spacing.lg, marginBottom: spacing.xs },
  reviewRow: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md },
  reviewStars: { color: colors.warning, fontSize: 13 },
  reviewComment: { ...typography.caption, marginTop: 4 },
  reviewFromRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  reviewFrom: { ...typography.small, color: colors.textMuted },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing.lg },
});
