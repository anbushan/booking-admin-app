import React, { useCallback, useState } from "react";
import { View, Text, TextInput, FlatList, StyleSheet, RefreshControl, Platform } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonBlock, SkeletonList } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { useToast } from "../components/Toast";
import { BackHeader } from "../components/BackHeader";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";
import { Analytics } from "../lib/analytics";
import { formatInr } from "../lib/money";
import { Share } from "react-native";

type ReferralInfo = {
  referralCode: string;
  rewardInr: number;
  refereeRewardInr: number;
  availableCreditInr: number;
  referrals: { id: string; status: string; refereeName: string; createdAt: string; completedAt: string | null }[];
};

// "Refer & earn" (see the code, share it, track who's redeemed it, see
// the running credit balance it's earned) plus "Have a code?" — a new
// rider redeeming a friend's referral code or a first-ride promo code —
// combined on one screen since they're really two sides of the same
// credit ledger (see backend's lib/credits.js). The credit itself is
// never something a rider "spends" here — it's applied automatically to
// the next platform fee at accept-time, so this screen is purely
// visibility + redemption, not a wallet to manage.
export default function RewardsScreen({ navigation }: any) {
  useScreenView("RewardsScreen");
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();

  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [redeemingReferral, setRedeemingReferral] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [redeemingPromo, setRedeemingPromo] = useState(false);

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    api.getReferralInfo()
      .then(setInfo)
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleShare() {
    if (!info || Platform.OS === "web") return;
    try {
      await Share.share({ message: t("rewards.shareMessage", { code: info.referralCode, amount: formatInr(info.refereeRewardInr) }) });
      Analytics.referralShared();
    } catch {
      // OS share sheet dismissed/cancelled — nothing to surface.
    }
  }

  async function handleRedeemReferral() {
    if (!referralCodeInput.trim()) return;
    setRedeemingReferral(true);
    try {
      const res = await api.redeemReferralCode(referralCodeInput.trim());
      Analytics.codeRedeemed("referral");
      showSuccess(t("rewards.referralRedeemed", { amount: formatInr(res.creditAppliedInr) }));
      setReferralCodeInput("");
      load();
    } catch (err: any) {
      showError(err.message || t("rewards.couldntRedeem"));
    } finally {
      setRedeemingReferral(false);
    }
  }

  async function handleRedeemPromo() {
    if (!promoCodeInput.trim()) return;
    setRedeemingPromo(true);
    try {
      const res = await api.redeemPromoCode(promoCodeInput.trim());
      Analytics.codeRedeemed("promo");
      // fullWaiver codes (MVP launch promos) don't carry a rupee amount
      // to report — their whole point is "the fee's free next time",
      // not a specific credit balance — so this gets its own message
      // rather than interpolating a null into the usual one.
      showSuccess(res.fullWaiver ? t("rewards.promoRedeemedFullWaiver") : t("rewards.promoRedeemed", { amount: formatInr(res.creditAppliedInr) }));
      setPromoCodeInput("");
      load();
    } catch (err: any) {
      showError(err.message || t("rewards.couldntRedeem"));
    } finally {
      setRedeemingPromo(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("rewards.title")} onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <SkeletonBlock style={{ height: 100, borderRadius: radius.md }} />
          <SkeletonBlock style={{ height: 140, borderRadius: radius.md }} />
          <SkeletonList count={2} />
        </View>
      ) : error || !info ? (
        <ErrorState message={t("rewards.couldntLoad")} onRetry={load} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={info.referrals}
          maxToRenderPerBatch={10}
          windowSize={8}
          initialNumToRender={10}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md, flexGrow: 1 }}
          ListHeaderComponent={
            <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
              {/* Available credit balance — the one number that actually
                  matters to a rider, since the credit itself is applied
                  invisibly at the next accept-time, not spent by hand. */}
              <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>{t("rewards.availableCredit")}</Text>
                <Text style={styles.balanceValue}>₹{formatInr(info.availableCreditInr)}</Text>
                <Text style={styles.balanceHint}>{t("rewards.creditHint")}</Text>
              </View>

              {/* Referrer side: this rider's own shareable code. */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t("rewards.referAndEarn")}</Text>
                <Text style={styles.cardSubtitle}>{t("rewards.referSubtitle", { amount: formatInr(info.rewardInr), friendAmount: formatInr(info.refereeRewardInr) })}</Text>
                <View style={styles.codeRow}>
                  <Text selectable style={styles.codeText}>{info.referralCode}</Text>
                </View>
                {Platform.OS !== "web" && (
                  <Pressable style={styles.shareButton} onPress={handleShare}>
                    <Ionicons name="share-social-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.shareButtonText}>{t("rewards.shareCode")}</Text>
                  </Pressable>
                )}
              </View>

              {/* Referee side: someone else's referral code, or a
                  first-ride promo code — both just eligibility-gated
                  UserCredit grants server-side (see referrals.routes.js /
                  promoCodes.routes.js), this screen doesn't need to know
                  which one a given code is. */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t("rewards.haveACode")}</Text>
                <Text style={styles.cardSubtitle}>{t("rewards.friendsCodeHint")}</Text>
                <View style={styles.redeemRow}>
                  <TextInput
                    style={styles.redeemInput}
                    placeholder={t("rewards.referralCodePlaceholder")}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    value={referralCodeInput}
                    onChangeText={setReferralCodeInput}
                  />
                  <Pressable
                    style={[styles.redeemButton, (!referralCodeInput.trim() || redeemingReferral) && styles.redeemButtonDisabled]}
                    onPress={handleRedeemReferral}
                    disabled={!referralCodeInput.trim() || redeemingReferral}
                  >
                    <Text style={styles.redeemButtonText}>{redeemingReferral ? t("rewards.redeeming") : t("rewards.redeem")}</Text>
                  </Pressable>
                </View>

                <Text style={[styles.cardSubtitle, { marginTop: spacing.md }]}>{t("rewards.promoCodeHint")}</Text>
                <View style={styles.redeemRow}>
                  <TextInput
                    style={styles.redeemInput}
                    placeholder={t("rewards.promoCodePlaceholder")}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    value={promoCodeInput}
                    onChangeText={setPromoCodeInput}
                  />
                  <Pressable
                    style={[styles.redeemButton, (!promoCodeInput.trim() || redeemingPromo) && styles.redeemButtonDisabled]}
                    onPress={handleRedeemPromo}
                    disabled={!promoCodeInput.trim() || redeemingPromo}
                  >
                    <Text style={styles.redeemButtonText}>{redeemingPromo ? t("rewards.redeeming") : t("rewards.redeem")}</Text>
                  </Pressable>
                </View>
              </View>

              {info.referrals.length > 0 && <Text style={styles.cardTitle}>{t("rewards.yourReferrals")}</Text>}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.referralRow}>
              <View>
                <Text style={styles.referralName}>{item.refereeName}</Text>
                <Text style={styles.referralDate}>
                  {new Date(item.createdAt).toLocaleDateString()}
                  {item.completedAt ? ` · ${t("rewards.paidOut", { date: new Date(item.completedAt).toLocaleDateString() })}` : ""}
                </Text>
              </View>
              <View style={[styles.statusPill, item.status === "COMPLETED" ? styles.statusPillDone : styles.statusPillWaiting]}>
                <Text style={[styles.statusPillText, item.status === "COMPLETED" ? { color: colors.success } : { color: colors.warning }]}>
                  {item.status === "COMPLETED" ? t("rewards.statusCompleted") : t("rewards.statusWaiting")}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState icon="people-outline" title={t("rewards.noReferralsYet")} subtitle={t("rewards.noReferralsSubtitle")} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  balanceCard: { backgroundColor: colors.accentBg, borderRadius: radius.md, padding: spacing.lg, alignItems: "center" },
  balanceLabel: { ...typography.small, color: colors.accentText },
  balanceValue: { fontSize: 32, fontWeight: "700", fontFamily: FONT.bold, color: colors.accentText, marginTop: 2 },
  balanceHint: { ...typography.small, color: colors.accentText, marginTop: spacing.xs, textAlign: "center" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg },
  cardTitle: { ...typography.body, fontFamily: FONT.semiBold, fontWeight: "600" },
  cardSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  codeRow: { borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.md, backgroundColor: colors.bg },
  codeText: { fontSize: 24, fontFamily: FONT.bold, fontWeight: "700", color: colors.textPrimary, letterSpacing: 4 },
  shareButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing.sm, marginTop: spacing.md },
  shareButtonText: { ...typography.body, fontSize: 14, color: "#FFFFFF", fontFamily: FONT.semiBold, fontWeight: "600" },
  redeemRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  redeemInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...typography.body, fontSize: 15, color: colors.textPrimary },
  redeemButton: { backgroundColor: colors.marigold, borderRadius: radius.sm, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center" },
  redeemButtonDisabled: { opacity: 0.5 },
  redeemButtonText: { color: "#FFFFFF", fontFamily: FONT.semiBold, fontWeight: "600", fontSize: 14 },
  referralRow: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  referralName: { ...typography.body, fontSize: 14 },
  referralDate: { ...typography.small, marginTop: 2 },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 999 },
  statusPillDone: { backgroundColor: colors.successBg },
  statusPillWaiting: { backgroundColor: colors.warningBg },
  statusPillText: { fontSize: 11, fontFamily: FONT.semiBold, fontWeight: "600" },
});
