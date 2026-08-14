import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, Platform } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import RazorpayCheckout from "react-native-razorpay";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { showAlert } from "../lib/alert";
import { useToast } from "../components/Toast";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import Avatar from "../components/Avatar";
import { CarLoader } from "../components/CarLoader";
import { ErrorState } from "../components/ErrorState";
import { FieldError } from "../components/FieldError";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";
import { appEvents } from "../lib/appEvents";

type AadhaarPreview = {
  aadhaarNumber: string; name: string | null; status: string | null; dob: string | null;
  gender: string | null; address: string | null; wouldPass: boolean;
};
type PassengerVerification = { paymentStatus: string; aadhaarStatus: string; confirmedPreview?: AadhaarPreview | null } | null;

// Same dev-only stand-in as VerifyDriverScreen.tsx — lets the whole
// pay -> check -> confirm -> badge flow be tested with EKO_MOCK_MODE
// data end to end without real Razorpay Checkout or real Eko access.
const SHOW_MOCK_PAYMENT_BUTTON = true;

// Mirrors verification.routes.js's AADHAAR_PATTERN exactly.
const AADHAAR_PATTERN = /^\d{12}$/;

function validateAadhaar(v: string, t: (k: string) => string) {
  const normalized = v.replace(/\s+/g, "");
  if (!normalized.trim()) return t("verification.aadhaarRequired");
  if (!AADHAAR_PATTERN.test(normalized)) return t("verification.aadhaarInvalid");
  return "";
}

// Same field-grid layout VerifyDriverScreen.tsx uses for its license/RC
// previews — a bunch of optional strings, skip the null ones, two per row.
function DetailGrid({ fields }: { fields: { label: string; value: string | null }[] }) {
  const present = fields.filter((f) => f.value);
  if (!present.length) return null;
  return (
    <View style={styles.detailGrid}>
      {present.map((f) => (
        <View key={f.label} style={styles.detailItem}>
          <Text style={styles.detailLabel}>{f.label}</Text>
          <Text style={styles.detailValue}>{f.value}</Text>
        </View>
      ))}
    </View>
  );
}

// Same ID-card look as VerifyDriverScreen.tsx's IdCard — dark title
// strip, monospaced-feeling number, VERIFIED stamp — kept as its own
// copy (not a shared import) since it's a small, self-contained visual
// component and the two screens' preview types don't line up 1:1.
// Unlike the driver's license/RC cards, this one also carries the
// passenger's own profile photo — a real Aadhaar card has a photo on
// it, and it's the one piece of Eko's response this app doesn't (and
// shouldn't) try to source from Eko itself; the account's existing
// profile photo stands in for it instead.
function IdCard({
  viewShotRef, title, number, status, wouldPass, fields, photoUri, name,
}: {
  viewShotRef: React.RefObject<ViewShot>;
  title: string;
  number: string;
  status: string | null;
  wouldPass: boolean;
  fields: { label: string; value: string | null }[];
  photoUri?: string | null;
  name?: string | null;
}) {
  return (
    <ViewShot ref={viewShotRef} options={{ format: "png", quality: 0.92 }} style={styles.idCard}>
      <View style={styles.idHeader}>
        <Ionicons name="person-circle" size={16} color="#FFFFFF" />
        <Text style={styles.idHeaderTitle}>{title}</Text>
        {wouldPass && (
          <View style={styles.idVerifiedStamp}>
            <Ionicons name="checkmark-circle" size={12} color={colors.success} />
            <Text style={styles.idVerifiedStampText}>VERIFIED</Text>
          </View>
        )}
      </View>
      <View style={styles.idBody}>
        <View style={styles.idTopRow}>
          <Avatar uri={photoUri} name={name} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.idNumberLabel}>AADHAAR NO.</Text>
            {/* The avatar takes real horizontal room the driver card's
                identical layout doesn't have to share — on the
                narrowest phones still in use (~320-360pt), a 12-char
                masked number at this font/letter-spacing can just about
                outrun what's left. Shrinks to fit rather than clipping
                or wrapping into the status chip below it. */}
            <Text style={styles.idNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{number}</Text>
            {status && (
              <View style={[styles.statusChip, wouldPass ? styles.statusChipGood : styles.statusChipBad, { marginTop: spacing.xs }]}>
                <Text style={[styles.statusChipText, { color: wouldPass ? colors.success : colors.danger }]}>{status}</Text>
              </View>
            )}
          </View>
        </View>
        <DetailGrid fields={fields} />
      </View>
    </ViewShot>
  );
}

export default function VerifyPassengerScreen({ navigation }: any) {
  useScreenView("VerifyPassengerScreen");
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [passengerVerification, setPassengerVerification] = useState<PassengerVerification>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [paying, setPaying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarError, setAadhaarError] = useState("");
  // Purely cosmetic (the ID card preview) — never sent anywhere, and
  // never blocks the flow if it fails to load, unlike passengerVerification
  // itself which does gate the whole screen via `error` below.
  const [profile, setProfile] = useState<{ name?: string; photoViewUrl?: string | null } | null>(null);

  // What Eko actually returned for the passenger's own review, before
  // it's committed as their official record — same preview-then-confirm
  // shape as the driver screen's license/RC.
  const [preview, setPreview] = useState<AadhaarPreview | null>(null);
  const cardRef = useRef<ViewShot>(null);

  function load() {
    setLoading(true);
    setError(false);
    api.getPassengerVerificationStatus()
      .then((data: any) => setPassengerVerification(data.passengerVerification))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useFocusEffect(useCallback(load, []));

  // Fetched once, separately from load()/the verification status poll —
  // this is just for the ID card preview's photo, not part of the
  // verification record itself, so it doesn't need to re-fetch on every
  // focus or payment-confirmed event the way passengerVerification does.
  useEffect(() => {
    api.getMyProfile().then(setProfile).catch(() => {});
  }, []);

  // Live push (see AppSocketBridge) — the same event the driver screen
  // listens for, just re-checked here too so paying and returning to
  // this screen doesn't need a background/foreground cycle to update.
  useEffect(() => appEvents.on("verification:paymentConfirmed", () => load()), []);

  const paid = passengerVerification?.paymentStatus === "PAID";
  const verified = passengerVerification?.aadhaarStatus === "VERIFIED";
  const pending = passengerVerification?.aadhaarStatus === "PENDING";
  const display = preview || passengerVerification?.confirmedPreview || null;

  async function handleDownload() {
    if (Platform.OS === "web") {
      showAlert(t("verification.couldntDownload"), t("verification.couldntDownloadBody"));
      return;
    }
    try {
      const uri = await cardRef.current?.capture?.();
      if (!uri) throw new Error(t("verification.couldntDownloadBody"));
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        showAlert(t("verification.couldntDownload"), t("verification.sharingUnavailable"));
        return;
      }
      await Sharing.shareAsync(uri);
    } catch (err: any) {
      showAlert(t("verification.couldntDownload"), err.message || t("verification.couldntDownloadBody"));
    }
  }

  async function handlePay() {
    setPaying(true);
    try {
      const order = await api.chargePassengerVerification();
      await RazorpayCheckout.open({
        key: order.keyId,
        amount: order.amount * 100,
        currency: "INR",
        order_id: order.orderId,
        name: "NanbaGO",
        description: t("verification.aadhaarFeeLabel"),
        theme: { color: "#1A1A18" },
      });
      // Same "Checkout closing cleanly isn't proof money moved" caveat
      // as everywhere else — the real confirmation is the webhook;
      // load() just refetches so the paid state shows once that lands.
      load();
    } catch (err: any) {
      if (err?.code !== 2 && !/cancel/i.test(err?.description || "")) {
        showAlert(t("payment.paymentFailed"), err.description || err.message || t("payment.pleaseTryAgain"));
      }
    } finally {
      setPaying(false);
    }
  }

  async function handleMockPay() {
    setPaying(true);
    try {
      await api.mockConfirmPassengerVerificationPayment();
      load();
    } catch (err: any) {
      showAlert(t("payment.couldntSimulate"), err.message);
    } finally {
      setPaying(false);
    }
  }

  async function handleCheck() {
    const err = validateAadhaar(aadhaarNumber, t);
    setAadhaarError(err);
    if (err) return;

    setChecking(true);
    try {
      const res = await api.verifyAadhaar(aadhaarNumber.replace(/\s+/g, ""));
      setPreview(res.preview);
      load();
    } catch (e: any) {
      showAlert(t("verification.couldntVerify"), e.message);
    } finally {
      setChecking(false);
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    try {
      await api.confirmAadhaarVerification();
      showSuccess(t("verification.aadhaarConfirmedToast"));
      setPreview(null);
      load();
    } catch (err: any) {
      showAlert(t("verification.couldntVerify"), err.message);
    } finally {
      setConfirming(false);
    }
  }

  function handleReset() {
    showAlert(t("verification.resetAadhaarTitle"), t("verification.resetAadhaarBody"), [
      { text: t("sideMenu.cancel"), style: "cancel" },
      {
        text: t("verification.resetAadhaarConfirm"),
        style: "destructive",
        onPress: async () => {
          setResetting(true);
          try {
            await api.resetPassengerVerification();
            setAadhaarNumber(""); setPreview(null);
            load();
          } catch (err: any) {
            showError(err.message || t("verification.couldntVerify"));
          } finally {
            setResetting(false);
          }
        },
      },
    ]);
  }

  const fields = display ? [
    { label: t("verification.nameLabel"), value: display.name },
    { label: t("verification.dobLabel"), value: display.dob },
    { label: t("verification.genderLabel"), value: display.gender },
    { label: t("verification.addressLabel"), value: display.address },
  ] : [];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("verification.passengerTitle")} onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message={t("verification.couldntLoad")} onRetry={load} />
      ) : (
        <KeyboardAvoider>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* Only worth explaining "why" before they've actually done it —
              same reasoning as the driver screen's whyCard. */}
          {!verified && (
            <View style={styles.whyCard}>
              <View style={styles.whyHeaderRow}>
                <Ionicons name="shield-checkmark" size={20} color={colors.accentText} />
                <Text style={styles.whyTitle}>{t("verification.passengerWhyTitle")}</Text>
              </View>
              <Text style={styles.whyBody}>{t("verification.passengerWhyBody")}</Text>
              <View style={styles.whyBullet}>
                <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} />
                <Text style={styles.whyBulletText}>{t("verification.passengerWhyBenefit1")}</Text>
              </View>
              <View style={styles.whyBullet}>
                <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} />
                <Text style={styles.whyBulletText}>{t("verification.passengerWhyBenefit2")}</Text>
              </View>
              <View style={styles.whyBullet}>
                <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
                <Text style={styles.whyBulletText}>{t("verification.passengerWhyOptional")}</Text>
              </View>
            </View>
          )}

          <View style={styles.card}>
            {passengerVerification?.aadhaarStatus === "FAILED" && !preview && (
              <View style={styles.failedRow}>
                <Ionicons name="close-circle" size={18} color={colors.danger} />
                <Text style={styles.failedText}>{t("verification.aadhaarFailed")}</Text>
              </View>
            )}

            {!paid ? (
              <>
                <Text style={styles.cardHint}>{t("verification.passengerFeeHint")}</Text>
                <Pressable style={styles.button} onPress={handlePay} disabled={paying}>
                  <Text style={styles.buttonText}>{paying ? t("payment.processing") : t("verification.payToVerify")}</Text>
                </Pressable>
                {SHOW_MOCK_PAYMENT_BUTTON && (
                  <Pressable style={styles.mockButton} onPress={handleMockPay} disabled={paying}>
                    <Text style={styles.mockButtonText}>{t("payment.simulatePaymentDev")}</Text>
                  </Pressable>
                )}
              </>
            ) : display ? (
              <>
                <IdCard
                  viewShotRef={cardRef}
                  title={t("verification.idCardAadhaarTitle")}
                  number={display.aadhaarNumber}
                  status={display.status}
                  wouldPass={display.wouldPass}
                  fields={fields}
                  photoUri={profile?.photoViewUrl}
                  name={display.name || profile?.name}
                />
                {!verified && (
                  <Text style={[styles.previewNote, { color: display.wouldPass ? colors.success : colors.danger, marginTop: spacing.sm }]}>
                    {display.wouldPass ? t("verification.previewGood") : t("verification.previewBad")}
                  </Text>
                )}
                <Pressable style={styles.downloadButton} onPress={handleDownload}>
                  <Ionicons name="download-outline" size={15} color={colors.accentText} />
                  <Text style={styles.downloadButtonText}>{t("verification.downloadCard")}</Text>
                </Pressable>
                {verified ? (
                  <Pressable style={styles.linkButton} onPress={handleReset} disabled={resetting}>
                    <Text style={styles.linkButtonText}>{resetting ? t("verification.resetting") : t("verification.verifyAgain")}</Text>
                  </Pressable>
                ) : (
                  <>
                    <Pressable style={styles.button} onPress={handleConfirm} disabled={confirming}>
                      <Text style={styles.buttonText}>{confirming ? t("verification.confirming") : t("verification.confirmAndSave")}</Text>
                    </Pressable>
                    <Pressable style={styles.linkButton} onPress={() => setPreview(null)} disabled={confirming}>
                      <Text style={styles.linkButtonText}>{t("verification.editAndRecheck")}</Text>
                    </Pressable>
                  </>
                )}
              </>
            ) : (
              <>
                {pending && <Text style={styles.cardHint}>{t("verification.pendingReview")}</Text>}
                <Text style={styles.label}>{t("verification.aadhaarNumber")}</Text>
                <TextInput
                  style={[styles.input, aadhaarError && styles.inputError]}
                  placeholder={t("verification.aadhaarNumberPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={14}
                  value={aadhaarNumber}
                  onChangeText={(v) => { setAadhaarNumber(v); if (aadhaarError) setAadhaarError(""); }}
                />
                <FieldError message={aadhaarError} />
                <Pressable style={styles.button} onPress={handleCheck} disabled={checking}>
                  <Text style={styles.buttonText}>{checking ? t("verification.checking") : t("verification.reviewDetails")}</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
        </KeyboardAvoider>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg },
  whyCard: { backgroundColor: colors.accentBg, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, marginBottom: spacing.sm },
  whyHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  whyTitle: { ...typography.title, fontSize: 14, color: colors.accentText },
  whyBody: { ...typography.caption, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.xs },
  whyBullet: { flexDirection: "row", alignItems: "center", gap: 6 },
  whyBulletText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  cardHint: { ...typography.small, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 17 },
  failedRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  failedText: { ...typography.caption, color: colors.danger },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    height: 44, paddingHorizontal: spacing.md, color: colors.textPrimary,
  },
  inputError: { borderColor: colors.danger },
  button: { backgroundColor: colors.textPrimary, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  buttonText: { ...typography.title, color: "#FFFFFF" },
  mockButton: { borderWidth: 1, borderColor: colors.warning, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  mockButtonText: { ...typography.caption, color: colors.warning, fontWeight: "700", fontFamily: FONT.bold },
  linkButton: { alignItems: "center", justifyContent: "center", marginTop: spacing.sm, padding: spacing.xs },
  linkButtonText: { ...typography.caption, color: colors.textMuted, textDecorationLine: "underline" },
  downloadButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: colors.border, height: 40, borderRadius: radius.sm, marginTop: spacing.sm },
  downloadButtonText: { ...typography.caption, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  previewNote: { ...typography.small, lineHeight: 16 },
  statusChip: { alignSelf: "flex-start", paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999 },
  statusChipGood: { backgroundColor: colors.successBg },
  statusChipBad: { backgroundColor: colors.dangerBg },
  statusChipText: { ...typography.small, fontWeight: "700", fontFamily: FONT.bold },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  detailItem: { width: "47%" },
  detailLabel: { ...typography.small, color: colors.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.3 },
  detailValue: { ...typography.caption, color: colors.textPrimary, fontWeight: "700", fontFamily: FONT.bold, marginTop: 1 },
  idCard: { borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  idHeader: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.textPrimary, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  idHeaderTitle: { ...typography.caption, color: "#FFFFFF", fontWeight: "700", fontFamily: FONT.bold, letterSpacing: 0.5, flex: 1 },
  idVerifiedStamp: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 },
  idVerifiedStampText: { fontSize: 9, fontWeight: "700", fontFamily: FONT.bold, color: colors.success, letterSpacing: 0.4 },
  idBody: { backgroundColor: colors.surface, padding: spacing.md },
  idTopRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  idNumberLabel: { ...typography.small, color: colors.textMuted, fontSize: 10, letterSpacing: 0.5 },
  idNumber: { fontSize: 18, fontWeight: "700", fontFamily: FONT.bold, color: colors.textPrimary, letterSpacing: 1, marginTop: 1 },
});
