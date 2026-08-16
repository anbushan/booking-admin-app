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
// pay -> send OTP -> verify OTP -> badge flow be tested with
// EKO_MOCK_MODE data end to end without real Razorpay Checkout or real
// Eko access. In mock mode, the one OTP that always succeeds is
// "123456" — same static test-OTP this app already uses for phone
// login (see auth.routes.js), reused here so there's only one mock-OTP
// convention to remember across the whole app.
const SHOW_MOCK_PAYMENT_BUTTON = true;
const MOCK_OTP_HINT = "123456";

// Mirrors verification.routes.js's AADHAAR_PATTERN exactly.
const AADHAAR_PATTERN = /^\d{12}$/;
const OTP_PATTERN = /^\d{6}$/;

function validateAadhaar(v: string, t: (k: string) => string) {
  const normalized = v.replace(/\s+/g, "");
  if (!normalized.trim()) return t("verification.aadhaarRequired");
  if (!AADHAAR_PATTERN.test(normalized)) return t("verification.aadhaarInvalid");
  return "";
}

function validateOtp(v: string, t: (k: string) => string) {
  if (!v.trim()) return t("verification.otpRequired");
  if (!OTP_PATTERN.test(v.trim())) return t("verification.otpInvalid");
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
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarError, setAadhaarError] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  // True the moment send-otp succeeds this session — combined with the
  // server's own aadhaarStatus === "PENDING" below (`pending`) so
  // reopening this screen while a real Eko OTP session is still valid
  // resumes straight at the OTP-entry step instead of making the
  // passenger request a new one for no reason.
  const [otpSentLocally, setOtpSentLocally] = useState(false);
  // Purely cosmetic (the ID card preview) — never sent anywhere, and
  // never blocks the flow if it fails to load, unlike passengerVerification
  // itself which does gate the whole screen via `error` below.
  const [profile, setProfile] = useState<{ name?: string; photoViewUrl?: string | null } | null>(null);

  // What Eko actually returned once the OTP itself was verified — unlike
  // license/RC, there's nothing to preview *before* this: UIDAI doesn't
  // hand back any data until OTP consent is already confirmed, so
  // confirm-otp is simultaneously "the check" and "the commit."
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
  const showOtpEntry = otpSentLocally || pending;
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

  async function handleSendOtp() {
    const err = validateAadhaar(aadhaarNumber, t);
    setAadhaarError(err);
    if (err) return;

    setSendingOtp(true);
    try {
      await api.sendAadhaarOtp(aadhaarNumber.replace(/\s+/g, ""));
      setOtpSentLocally(true);
      setOtp("");
      setOtpError("");
      showSuccess(t("verification.otpSentToast"));
      load();
    } catch (e: any) {
      showAlert(t("verification.couldntSendOtp"), e.message);
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    const err = validateOtp(otp, t);
    setOtpError(err);
    if (err) return;

    setVerifyingOtp(true);
    try {
      const res = await api.confirmAadhaarOtp(otp.trim());
      if (res.passengerVerification?.aadhaarStatus === "VERIFIED") {
        setPreview(res.preview);
        setOtpSentLocally(false);
        showSuccess(t("verification.aadhaarConfirmedToast"));
      } else {
        // Failed OTP/e-KYC attempt — back to the Aadhaar-number step;
        // no reset/re-payment needed, the backend allows retrying
        // send-otp on anything short of an already-VERIFIED record.
        setOtpSentLocally(false);
        setOtp("");
        showAlert(t("verification.couldntVerify"), res.error || t("verification.aadhaarFailed"));
      }
      load();
    } catch (e: any) {
      showAlert(t("verification.couldntVerify"), e.message);
    } finally {
      setVerifyingOtp(false);
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
            setAadhaarNumber(""); setOtp(""); setPreview(null); setOtpSentLocally(false);
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
            ) : verified && display ? (
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
                <Pressable style={styles.downloadButton} onPress={handleDownload}>
                  <Ionicons name="download-outline" size={15} color={colors.accentText} />
                  <Text style={styles.downloadButtonText}>{t("verification.downloadCard")}</Text>
                </Pressable>
                <Pressable style={styles.linkButton} onPress={handleReset} disabled={resetting}>
                  <Text style={styles.linkButtonText}>{resetting ? t("verification.resetting") : t("verification.verifyAgain")}</Text>
                </Pressable>
              </>
            ) : showOtpEntry ? (
              <>
                {/* Real Aadhaar e-KYC is OTP-consent-based (a UIDAI legal
                    requirement, not an Eko quirk) — the OTP goes to
                    whatever mobile number is linked with this Aadhaar in
                    UIDAI's own records, never a number this app has on
                    file, so there's genuinely nothing to preview until
                    it's entered here. */}
                <View style={styles.otpSentRow}>
                  <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.accentText} />
                  <Text style={styles.otpSentText}>{t("verification.otpSentHint")}</Text>
                </View>
                {SHOW_MOCK_PAYMENT_BUTTON && (
                  <Text style={styles.mockOtpHint}>{t("verification.mockOtpHint", { otp: MOCK_OTP_HINT })}</Text>
                )}
                <Text style={styles.label}>{t("verification.otpLabel")}</Text>
                <TextInput
                  style={[styles.input, otpError && styles.inputError]}
                  placeholder={t("verification.otpPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={(v) => { setOtp(v); if (otpError) setOtpError(""); }}
                />
                <FieldError message={otpError} />
                <Pressable style={styles.button} onPress={handleVerifyOtp} disabled={verifyingOtp}>
                  <Text style={styles.buttonText}>{verifyingOtp ? t("verification.verifyingOtp") : t("verification.verifyOtp")}</Text>
                </Pressable>
                <Pressable
                  style={styles.linkButton}
                  onPress={() => { setOtpSentLocally(false); setOtp(""); setOtpError(""); }}
                  disabled={verifyingOtp}
                >
                  <Text style={styles.linkButtonText}>{t("verification.changeAadhaarNumber")}</Text>
                </Pressable>
              </>
            ) : (
              <>
                {passengerVerification?.aadhaarStatus === "FAILED" && (
                  <View style={styles.failedRow}>
                    <Ionicons name="close-circle" size={18} color={colors.danger} />
                    <Text style={styles.failedText}>{t("verification.aadhaarFailed")}</Text>
                  </View>
                )}
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
                <Pressable style={styles.button} onPress={handleSendOtp} disabled={sendingOtp}>
                  <Text style={styles.buttonText}>{sendingOtp ? t("verification.sendingOtp") : t("verification.sendOtp")}</Text>
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
  otpSentRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.accentBg, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.xs },
  otpSentText: { ...typography.caption, color: colors.accentText, flex: 1, lineHeight: 17 },
  mockOtpHint: { ...typography.small, color: colors.warning, marginBottom: spacing.sm },
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
