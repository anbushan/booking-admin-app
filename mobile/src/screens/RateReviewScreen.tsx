import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RateReviewScreen({ route, navigation }: any) {
  const { bookingId, toUserId, toUserName } = route.params;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { showSuccess } = useToast();

  async function handleSubmit() {
    if (rating === 0) {
      showAlert("Choose a rating", "Tap a star to rate your trip.");
      return;
    }
    setSubmitting(true);
    try {
      await api.submitReview({ bookingId, toUserId, rating, comment });
      Analytics.reviewSubmitted(rating);
      showSuccess("Review submitted");
      navigation.goBack();
    } catch (err: any) {
      showAlert("Couldn't submit review", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.title}>Rate your trip with {toUserName}</Text>

      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)}>
            <Text style={[styles.star, n <= rating && styles.starActive]}>{"\u2605"}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Add a comment (optional)"
        placeholderTextColor={colors.textMuted}
        value={comment}
        onChangeText={setComment}
        multiline
      />

      <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? "Submitting..." : "Submit review"}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: "center" },
  title: { ...typography.title, textAlign: "center", marginBottom: spacing.lg },
  stars: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginBottom: spacing.lg },
  star: { fontSize: 32, color: colors.border },
  starActive: { color: colors.warning },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    minHeight: 80,
    padding: spacing.md,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  buttonText: { color: "#FFFFFF", ...typography.title },
});
