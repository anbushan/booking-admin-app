import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

export default function RateReviewScreen({ route, navigation }: any) {
  useScreenView("RateReviewScreen");
  const { t } = useTranslation();
  const { bookingId, toUserId, toUserName } = route.params;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { showSuccess } = useToast();

  async function handleSubmit() {
    if (rating === 0) {
      showAlert(t("rateReview.chooseRatingTitle"), t("rateReview.chooseRatingBody"));
      return;
    }
    setSubmitting(true);
    try {
      await api.submitReview({ bookingId, toUserId, rating, comment });
      Analytics.reviewSubmitted(rating);
      showSuccess(t("rateReview.reviewSubmitted"));
      // Not goBack() — this screen is reached via navigation.replace()
      // from a just-ended trip (see LiveTrackingScreen), so "back" is
      // whatever happened to precede that, not a predictable place.
      // Resetting straight to Home is the reliable landing spot either
      // way, for both the passenger and driver rate-review flows.
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (err: any) {
      showAlert(t("rateReview.couldntSubmit"), err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader
        title={t("rateReview.title")}
        onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.reset({ index: 0, routes: [{ name: "Home" }] }))}
        right={
          <Pressable onPress={() => navigation.reset({ index: 0, routes: [{ name: "Home" }] })} hitSlop={8}>
            <Text style={styles.skipText}>{t("onboarding.skip")}</Text>
          </Pressable>
        }
      />
      <KeyboardAvoider style={styles.centerContent}>
        <Text style={styles.title}>{t("rateReview.rateTripWith", { name: toUserName })}</Text>

        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)}>
              <Text style={[styles.star, n <= rating && styles.starActive]}>{"\u2605"}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder={t("rateReview.commentPlaceholder")}
          placeholderTextColor={colors.textMuted}
          value={comment}
          onChangeText={setComment}
          multiline
        />

        <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? t("rateReview.submitting") : t("rateReview.submitReview")}</Text>
        </Pressable>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centerContent: { padding: spacing.lg, justifyContent: "center" },
  skipText: { ...typography.caption, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
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
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  buttonText: { ...typography.title, color: "#FFFFFF" },
});
