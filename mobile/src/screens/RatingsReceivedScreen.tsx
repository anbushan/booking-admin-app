import React, { useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "../components/AppHeader";
import { AppBottomNav } from "../components/AppBottomNav";

export default function RatingsReceivedScreen({ navigation }: any) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    api
      .getMyProfile()
      .then((profile) => {
        setProfile(profile);
        setAvgRating(profile.ratingAvg);
        return api.getReviewsForUser(profile.id);
      })
      .then(setReviews)
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useFocusEffect(useCallback(load, []));

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <AppHeader title="Your ratings" />

      {loading ? (
        <SkeletonList count={3} />
      ) : error ? (
        <ErrorState message="Couldn't load your ratings." onRetry={load} />
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryValue}>{avgRating ? avgRating.toFixed(1) : "—"}</Text>
            <Text style={styles.summaryLabel}>Average rating · {reviews.length} review(s)</Text>
          </View>

          <FlatList
            data={reviews}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.stars}>{"\u2605".repeat(item.rating)}{"\u2606".repeat(5 - item.rating)}</Text>
                {item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null}
                <Text style={styles.from}>{item.fromUser?.name || "Rider"}</Text>
              </View>
            )}
            ListEmptyComponent={<EmptyState icon="star-outline" title="No reviews yet" />}
          />
        </>
      )}
      <AppBottomNav navigation={navigation} profile={profile} active="menu" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  summary: { alignItems: "center", padding: spacing.lg },
  summaryValue: { fontSize: 32, fontWeight: "500", color: colors.warning },
  summaryLabel: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md },
  stars: { color: colors.warning, fontSize: 14 },
  comment: { ...typography.caption, marginTop: 4 },
  from: { ...typography.small, color: colors.textMuted, marginTop: 4 },
});
