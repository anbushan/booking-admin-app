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
import { Analytics } from "../lib/analytics";
import { CarLoader } from "../components/CarLoader";
import { ErrorState } from "../components/ErrorState";
import { FieldError } from "../components/FieldError";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";
import { appEvents } from "../lib/appEvents";

type LicensePreview = {
  dlNumber: string; name: string | null; status: string | null; dob: string | null;
  address: string | null; issueDate: string | null; nonTransportValidUpto: string | null;
  transportValidUpto: string | null; vehicleClasses: string[]; wouldPass: boolean;
};
type RcPreview = {
  regNumber: string; owner: string | null; status: string | null; expiryDate: string | null;
  registrationDate: string | null; vehicleClass: string | null; makerModel: string | null;
  fuelType: string | null; chassisNumber: string | null; engineNumber: string | null;
  insuranceUpto: string | null; insuranceCompany: string | null; puccUpto: string | null; wouldPass: boolean;
};
type Vehicle = {
  id: string;
  make: string;
  model: string;
  regNumber: string;
  verification: { paymentStatus: string; rcStatus: string; confirmedPreview?: RcPreview | null } | null;
};
type DriverVerification = { paymentStatus: string; licenseStatus: string; confirmedPreview?: LicensePreview | null } | null;

// Same fallback PaymentScreen.tsx uses — react-native-razorpay is a
// native module unavailable in Expo Go / web preview, so this dev-only
// button skips straight to what the real webhook does (backend 404s it
// unless ALLOW_MOCK_PAYMENT_CONFIRM=true, so it's a no-op button
// anywhere that isn't set). Lets the whole pay -> check -> confirm ->
// badge flow be tested with EKO_MOCK_MODE data end to end without
// either a real Razorpay Checkout session or real Eko access.
const SHOW_MOCK_PAYMENT_BUTTON = true;

// Mirrors verification.routes.js's DL_NUMBER_PATTERN exactly — loose on
// purpose (state RTO formats vary widely), just alphanumeric-with-
// separators of a plausible length, so the client catches an obviously
// empty/garbage entry before spending a paid Eko lookup on it.
const DL_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-/ ]{5,19}$/;
const DOB_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validateDlNumber(v: string, t: (k: string) => string) {
  if (!v.trim()) return t("verification.dlNumberRequired");
  if (!DL_NUMBER_PATTERN.test(v.trim())) return t("verification.dlNumberInvalid");
  return "";
}

function validateDob(v: string, t: (k: string) => string) {
  if (!v.trim()) return t("verification.dobRequired");
  if (!DOB_PATTERN.test(v.trim())) return t("verification.dobInvalidFormat");
  const d = new Date(v.trim());
  if (isNaN(d.getTime())) return t("verification.dobInvalidFormat");
  if (d.getTime() > Date.now()) return t("verification.dobInFuture");
  const ageYears = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears < 18) return t("verification.dobTooYoung");
  if (ageYears > 100) return t("verification.dobInvalidFormat");
  return "";
}

// A label/value grid for whatever Eko actually returned — built once
// and reused for both the license and RC previews rather than two
// near-identical field lists, since both are "here's a bunch of
// optional strings, skip the null ones, lay out two per row."
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

// Styled to read like an actual Indian ID document rather than a plain
// settings row — a dark title strip (the closest a form-driven layout
// gets to a card's printed header band) with a "VERIFIED"/pending
// stamp in the corner, the number in a monospaced-feeling emphasis,
// then the rest of the fields in the same grid as the pre-confirm
// preview. One component for both the license and every vehicle's RC.
function IdCard({
  viewShotRef, kind, title, number, status, wouldPass, fields,
}: {
  viewShotRef: React.RefObject<ViewShot>;
  kind: "license" | "rc";
  title: string;
  number: string;
  status: string | null;
  wouldPass: boolean;
  fields: { label: string; value: string | null }[];
}) {
  return (
    <ViewShot ref={viewShotRef} options={{ format: "png", quality: 0.92 }} style={styles.idCard}>
      <View style={styles.idHeader}>
        <Ionicons name={kind === "license" ? "card" : "car-sport"} size={16} color="#FFFFFF" />
        <Text style={styles.idHeaderTitle}>{title}</Text>
        {wouldPass && (
          <View style={styles.idVerifiedStamp}>
            <Ionicons name="checkmark-circle" size={12} color={colors.success} />
            <Text style={styles.idVerifiedStampText}>VERIFIED</Text>
          </View>
        )}
      </View>
      <View style={styles.idBody}>
        <Text style={styles.idNumberLabel}>{kind === "license" ? "DL NO." : "REG NO."}</Text>
        {/* DL numbers can run up to 20 characters (DL_NUMBER_PATTERN) —
            at this font size/letter-spacing that can outrun the card's
            width on the narrowest phones still in use. Shrinks to fit
            rather than clipping or wrapping mid-number. */}
        <Text style={styles.idNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{number}</Text>
        {status && (
          <View style={[styles.statusChip, wouldPass ? styles.statusChipGood : styles.statusChipBad, { marginTop: spacing.xs }]}>
            <Text style={[styles.statusChipText, { color: wouldPass ? colors.success : colors.danger }]}>{status}</Text>
          </View>
        )}
        <DetailGrid fields={fields} />
      </View>
    </ViewShot>
  );
}

export default function VerifyDriverScreen({ navigation }: any) {
  useScreenView("VerifyDriverScreen");
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [driverVerification, setDriverVerification] = useState<DriverVerification>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [payingDriver, setPayingDriver] = useState(false);
  const [checkingDriver, setCheckingDriver] = useState(false);
  const [confirmingDriver, setConfirmingDriver] = useState(false);
  const [resettingDriver, setResettingDriver] = useState(false);
  const [payingVehicleId, setPayingVehicleId] = useState<string | null>(null);
  const [checkingVehicleId, setCheckingVehicleId] = useState<string | null>(null);
  const [confirmingVehicleId, setConfirmingVehicleId] = useState<string | null>(null);
  const [dlNumber, setDlNumber] = useState("");
  const [dob, setDob] = useState(""); // YYYY-MM-DD, matches Eko's documented format
  const [licenseErrors, setLicenseErrors] = useState<{ dlNumber?: string; dob?: string }>({});

  // What Eko actually returned for the driver's own review, before it's
  // committed as their official record — only ever lives client-side;
  // the backend just holds PENDING + the raw response until /confirm.
  const [licensePreview, setLicensePreview] = useState<LicensePreview | null>(null);
  const [vehiclePreviews, setVehiclePreviews] = useState<Record<string, RcPreview>>({});

  const licenseCardRef = useRef<ViewShot>(null);
  const vehicleCardRefs = useRef<Record<string, React.RefObject<ViewShot>>>({});
  function vehicleCardRef(id: string) {
    if (!vehicleCardRefs.current[id]) vehicleCardRefs.current[id] = React.createRef<ViewShot>();
    return vehicleCardRefs.current[id];
  }

  function load() {
    setLoading(true);
    setError(false);
    api.getVerificationStatus()
      .then((data: any) => { setDriverVerification(data.driverVerification); setVehicles(data.vehicles); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useFocusEffect(useCallback(load, []));

  // Live push (see AppSocketBridge) rather than waiting for this screen
  // to lose and regain focus — someone sitting right here after paying
  // shouldn't need to background/foreground the app to see the pay
  // button replaced with the check/confirm one.
  useEffect(() => appEvents.on("verification:paymentConfirmed", () => load()), []);

  const driverPaid = driverVerification?.paymentStatus === "PAID";
  const licenseVerified = driverVerification?.licenseStatus === "VERIFIED";
  const licensePending = driverVerification?.licenseStatus === "PENDING";
  const licenseDisplay = licensePreview || driverVerification?.confirmedPreview || null;

  async function handleDownload(ref: React.RefObject<ViewShot>) {
    // Same device-only caveat as RazorpayCheckout below — view capture
    // relies on findNodeHandle, which react-native-web doesn't
    // implement at all. Checked up front rather than just letting
    // .capture() throw, since that raw error ("findNodeHandle is not
    // supported on web...") isn't something a driver can act on.
    if (Platform.OS === "web") {
      showAlert(t("verification.couldntDownload"), t("verification.couldntDownloadBody"));
      return;
    }
    try {
      const uri = await ref.current?.capture?.();
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

  async function handlePayDriver() {
    setPayingDriver(true);
    try {
      const order = await api.chargeDriverVerification();
      await RazorpayCheckout.open({
        key: order.keyId,
        amount: order.amount * 100,
        currency: "INR",
        order_id: order.orderId,
        name: "NanbaGO",
        description: t("verification.licenseFeeLabel"),
        theme: { color: "#1A1A18" },
      });
      // Same "Checkout closing cleanly isn't proof money moved" caveat
      // PaymentScreen has — the real confirmation is the webhook; load()
      // just refetches so the paid state shows once that's landed.
      Analytics.driverVerificationPaid();
      load();
    } catch (err: any) {
      if (err?.code !== 2 && !/cancel/i.test(err?.description || "")) {
        showAlert(t("payment.paymentFailed"), err.description || err.message || t("payment.pleaseTryAgain"));
      }
    } finally {
      setPayingDriver(false);
    }
  }

  async function handleMockPayDriver() {
    setPayingDriver(true);
    try {
      await api.mockConfirmDriverVerificationPayment();
      load();
    } catch (err: any) {
      showAlert(t("payment.couldntSimulate"), err.message);
    } finally {
      setPayingDriver(false);
    }
  }

  async function handleCheckLicense() {
    const dlError = validateDlNumber(dlNumber, t);
    const dobError = validateDob(dob, t);
    setLicenseErrors({ dlNumber: dlError, dob: dobError });
    if (dlError || dobError) return;

    setCheckingDriver(true);
    try {
      const res = await api.verifyDriverLicense(dlNumber.trim(), dob.trim());
      setLicensePreview(res.preview);
      load();
    } catch (err: any) {
      showAlert(t("verification.couldntVerify"), err.message);
    } finally {
      setCheckingDriver(false);
    }
  }

  async function handleConfirmLicense() {
    setConfirmingDriver(true);
    try {
      await api.confirmDriverLicense();
      Analytics.driverVerificationChecked();
      showSuccess(t("verification.licenseConfirmedToast"));
      setLicensePreview(null);
      load();
    } catch (err: any) {
      showAlert(t("verification.couldntVerify"), err.message);
    } finally {
      setConfirmingDriver(false);
    }
  }

  function handleResetLicense() {
    showAlert(t("verification.resetLicenseTitle"), t("verification.resetLicenseBody"), [
      { text: t("sideMenu.cancel"), style: "cancel" },
      {
        text: t("verification.resetLicenseConfirm"),
        style: "destructive",
        onPress: async () => {
          setResettingDriver(true);
          try {
            await api.resetDriverVerification();
            setDlNumber(""); setDob(""); setLicensePreview(null);
            load();
          } catch (err: any) {
            showError(err.message || t("verification.couldntVerify"));
          } finally {
            setResettingDriver(false);
          }
        },
      },
    ]);
  }

  async function handlePayVehicle(vehicleId: string) {
    setPayingVehicleId(vehicleId);
    try {
      const order = await api.chargeVehicleVerification(vehicleId);
      await RazorpayCheckout.open({
        key: order.keyId,
        amount: order.amount * 100,
        currency: "INR",
        order_id: order.orderId,
        name: "NanbaGO",
        description: t("verification.rcFeeLabel"),
        theme: { color: "#1A1A18" },
      });
      load();
    } catch (err: any) {
      if (err?.code !== 2 && !/cancel/i.test(err?.description || "")) {
        showAlert(t("payment.paymentFailed"), err.description || err.message || t("payment.pleaseTryAgain"));
      }
    } finally {
      setPayingVehicleId(null);
    }
  }

  async function handleMockPayVehicle(vehicleId: string) {
    setPayingVehicleId(vehicleId);
    try {
      await api.mockConfirmVehicleVerificationPayment(vehicleId);
      load();
    } catch (err: any) {
      showAlert(t("payment.couldntSimulate"), err.message);
    } finally {
      setPayingVehicleId(null);
    }
  }

  async function handleCheckVehicle(vehicleId: string) {
    setCheckingVehicleId(vehicleId);
    try {
      const res = await api.verifyVehicleRC(vehicleId);
      setVehiclePreviews((prev) => ({ ...prev, [vehicleId]: res.preview }));
      load();
    } catch (err: any) {
      showAlert(t("verification.couldntVerify"), err.message);
    } finally {
      setCheckingVehicleId(null);
    }
  }

  async function handleConfirmVehicle(vehicleId: string) {
    setConfirmingVehicleId(vehicleId);
    try {
      await api.confirmVehicleRC(vehicleId);
      showSuccess(t("verification.rcConfirmedToast"));
      setVehiclePreviews((prev) => {
        const next = { ...prev };
        delete next[vehicleId];
        return next;
      });
      load();
    } catch (err: any) {
      showAlert(t("verification.couldntVerify"), err.message);
    } finally {
      setConfirmingVehicleId(null);
    }
  }

  const licenseFields = licenseDisplay ? [
    { label: t("verification.nameLabel"), value: licenseDisplay.name },
    { label: t("verification.dobLabel"), value: licenseDisplay.dob },
    { label: t("verification.issuedLabel"), value: licenseDisplay.issueDate },
    { label: t("verification.nonTransportValidLabel"), value: licenseDisplay.nonTransportValidUpto },
    { label: t("verification.transportValidLabel"), value: licenseDisplay.transportValidUpto },
    { label: t("verification.vehicleClassesLabel"), value: licenseDisplay.vehicleClasses.join(", ") || null },
    { label: t("verification.addressLabel"), value: licenseDisplay.address },
  ] : [];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("verification.title")} onBack={() => navigation.goBack()} />
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
              once verified, the done-state below already speaks for
              itself and re-explaining the pitch would just be noise. */}
          {!licenseVerified && (
            <View style={styles.whyCard}>
              <View style={styles.whyHeaderRow}>
                <Ionicons name="shield-checkmark" size={20} color={colors.accentText} />
                <Text style={styles.whyTitle}>{t("verification.whyTitle")}</Text>
              </View>
              <Text style={styles.whyBody}>{t("verification.whyBody")}</Text>
              <View style={styles.whyBullet}>
                <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} />
                <Text style={styles.whyBulletText}>{t("verification.whyBenefit1")}</Text>
              </View>
              <View style={styles.whyBullet}>
                <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} />
                <Text style={styles.whyBulletText}>{t("verification.whyBenefit2")}</Text>
              </View>
              <View style={styles.whyBullet}>
                <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} />
                <Text style={styles.whyBulletText}>{t("verification.whyBenefit3")}</Text>
              </View>
            </View>
          )}

          <View style={styles.sectionHeaderRow}>
            <Ionicons name="card-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.sectionLabel}>{t("verification.yourLicense")}</Text>
          </View>
          <View style={styles.card}>
            {driverVerification?.licenseStatus === "FAILED" && !licensePreview && (
              <View style={styles.failedRow}>
                <Ionicons name="close-circle" size={18} color={colors.danger} />
                <Text style={styles.failedText}>{t("verification.licenseFailed")}</Text>
              </View>
            )}

            {!driverPaid ? (
              <>
                <Text style={styles.cardHint}>{t("verification.driverFeeHint")}</Text>
                <Pressable style={styles.button} onPress={handlePayDriver} disabled={payingDriver}>
                  <Text style={styles.buttonText}>{payingDriver ? t("payment.processing") : t("verification.payToVerify")}</Text>
                </Pressable>
                {SHOW_MOCK_PAYMENT_BUTTON && (
                  <Pressable style={styles.mockButton} onPress={handleMockPayDriver} disabled={payingDriver}>
                    <Text style={styles.mockButtonText}>{t("payment.simulatePaymentDev")}</Text>
                  </Pressable>
                )}
              </>
            ) : licenseDisplay ? (
              <>
                <IdCard
                  viewShotRef={licenseCardRef}
                  kind="license"
                  title={t("verification.idCardLicenseTitle")}
                  number={licenseDisplay.dlNumber}
                  status={licenseDisplay.status}
                  wouldPass={licenseDisplay.wouldPass}
                  fields={licenseFields}
                />
                {!licenseVerified && (
                  <Text style={[styles.previewNote, { color: licenseDisplay.wouldPass ? colors.success : colors.danger, marginTop: spacing.sm }]}>
                    {licenseDisplay.wouldPass ? t("verification.previewGood") : t("verification.previewBad")}
                  </Text>
                )}
                <Pressable style={styles.downloadButton} onPress={() => handleDownload(licenseCardRef)}>
                  <Ionicons name="download-outline" size={15} color={colors.accentText} />
                  <Text style={styles.downloadButtonText}>{t("verification.downloadCard")}</Text>
                </Pressable>
                {licenseVerified ? (
                  <Pressable style={styles.linkButton} onPress={handleResetLicense} disabled={resettingDriver}>
                    <Text style={styles.linkButtonText}>{resettingDriver ? t("verification.resetting") : t("verification.verifyAgain")}</Text>
                  </Pressable>
                ) : (
                  <>
                    <Pressable style={styles.button} onPress={handleConfirmLicense} disabled={confirmingDriver}>
                      <Text style={styles.buttonText}>{confirmingDriver ? t("verification.confirming") : t("verification.confirmAndSave")}</Text>
                    </Pressable>
                    <Pressable style={styles.linkButton} onPress={() => setLicensePreview(null)} disabled={confirmingDriver}>
                      <Text style={styles.linkButtonText}>{t("verification.editAndRecheck")}</Text>
                    </Pressable>
                  </>
                )}
              </>
            ) : (
              <>
                {licensePending && <Text style={styles.cardHint}>{t("verification.pendingReview")}</Text>}
                <Text style={styles.label}>{t("verification.dlNumber")}</Text>
                <TextInput
                  style={[styles.input, licenseErrors.dlNumber && styles.inputError]}
                  placeholder={t("verification.dlNumberPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  value={dlNumber}
                  onChangeText={(v) => { setDlNumber(v); if (licenseErrors.dlNumber) setLicenseErrors((e) => ({ ...e, dlNumber: "" })); }}
                />
                <FieldError message={licenseErrors.dlNumber} />
                <Text style={styles.label}>{t("verification.dob")}</Text>
                <TextInput
                  style={[styles.input, licenseErrors.dob && styles.inputError]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  value={dob}
                  onChangeText={(v) => { setDob(v); if (licenseErrors.dob) setLicenseErrors((e) => ({ ...e, dob: "" })); }}
                />
                <FieldError message={licenseErrors.dob} />
                <Pressable style={styles.button} onPress={handleCheckLicense} disabled={checkingDriver}>
                  <Text style={styles.buttonText}>{checkingDriver ? t("verification.checking") : t("verification.reviewDetails")}</Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.sectionHeaderRow}>
            <Ionicons name="car-sport-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.sectionLabel}>{t("verification.yourVehicles")}</Text>
          </View>
          {vehicles.map((v) => {
            const vv = v.verification;
            const vPaid = vv?.paymentStatus === "PAID" || vv?.paymentStatus === "WAIVED";
            const vVerified = vv?.rcStatus === "VERIFIED";
            const vPending = vv?.rcStatus === "PENDING";
            const rcDisplay = vehiclePreviews[v.id] || vv?.confirmedPreview || null;
            const rcFields = rcDisplay ? [
              { label: t("verification.ownerLabel"), value: rcDisplay.owner },
              { label: t("verification.registeredLabel"), value: rcDisplay.registrationDate },
              { label: t("verification.expiryLabel"), value: rcDisplay.expiryDate },
              { label: t("verification.vehicleClassLabel"), value: rcDisplay.vehicleClass },
              { label: t("verification.modelLabel"), value: rcDisplay.makerModel },
              { label: t("verification.fuelLabel"), value: rcDisplay.fuelType },
              { label: t("verification.chassisLabel"), value: rcDisplay.chassisNumber },
              { label: t("verification.engineLabel"), value: rcDisplay.engineNumber },
              { label: t("verification.insuranceValidLabel"), value: rcDisplay.insuranceUpto },
              { label: t("verification.insurerLabel"), value: rcDisplay.insuranceCompany },
              { label: t("verification.puccValidLabel"), value: rcDisplay.puccUpto },
            ] : [];
            return (
              <View key={v.id} style={styles.card}>
                <Text style={styles.vehicleName}>{v.make} {v.model} · {v.regNumber}</Text>
                {rcDisplay ? (
                  <>
                    <IdCard
                      viewShotRef={vehicleCardRef(v.id)}
                      kind="rc"
                      title={t("verification.idCardRcTitle")}
                      number={rcDisplay.regNumber}
                      status={rcDisplay.status}
                      wouldPass={rcDisplay.wouldPass}
                      fields={rcFields}
                    />
                    {!vVerified && (
                      <Text style={[styles.previewNote, { color: rcDisplay.wouldPass ? colors.success : colors.danger, marginTop: spacing.sm }]}>
                        {rcDisplay.wouldPass ? t("verification.previewGood") : t("verification.previewBad")}
                      </Text>
                    )}
                    <Pressable style={styles.downloadButton} onPress={() => handleDownload(vehicleCardRef(v.id))}>
                      <Ionicons name="download-outline" size={15} color={colors.accentText} />
                      <Text style={styles.downloadButtonText}>{t("verification.downloadCard")}</Text>
                    </Pressable>
                    {!vVerified && (
                      <Pressable style={styles.button} onPress={() => handleConfirmVehicle(v.id)} disabled={confirmingVehicleId === v.id}>
                        <Text style={styles.buttonText}>{confirmingVehicleId === v.id ? t("verification.confirming") : t("verification.confirmAndSave")}</Text>
                      </Pressable>
                    )}
                    {vVerified && (
                      <Text style={styles.rcVerifiedHint}>{t("verification.rcEditHint")}</Text>
                    )}
                  </>
                ) : !vPaid ? (
                  <>
                    <Text style={styles.cardHint}>{t("verification.vehicleFeeHint")}</Text>
                    <Pressable style={styles.button} onPress={() => handlePayVehicle(v.id)} disabled={payingVehicleId === v.id}>
                      <Text style={styles.buttonText}>{payingVehicleId === v.id ? t("payment.processing") : t("verification.payToVerify")}</Text>
                    </Pressable>
                    {SHOW_MOCK_PAYMENT_BUTTON && (
                      <Pressable style={styles.mockButton} onPress={() => handleMockPayVehicle(v.id)} disabled={payingVehicleId === v.id}>
                        <Text style={styles.mockButtonText}>{t("payment.simulatePaymentDev")}</Text>
                      </Pressable>
                    )}
                  </>
                ) : (
                  <>
                    {vPending && <Text style={styles.cardHint}>{t("verification.pendingReview")}</Text>}
                    <Pressable style={styles.button} onPress={() => handleCheckVehicle(v.id)} disabled={checkingVehicleId === v.id}>
                      <Text style={styles.buttonText}>{checkingVehicleId === v.id ? t("verification.checking") : t("verification.reviewDetails")}</Text>
                    </Pressable>
                  </>
                )}
              </View>
            );
          })}

          {vehicles.length === 0 ? (
            // No way to verify an RC without a vehicle to check in the
            // first place — send them straight to the add-vehicle form
            // instead of a dead-end empty list.
            <View style={styles.card}>
              <Text style={styles.cardHint}>{t("verification.noVehiclesHint")}</Text>
              <Pressable style={styles.button} onPress={() => navigation.navigate("DriverOnboarding")}>
                <Text style={styles.buttonText}>{t("verification.addVehicleLink")}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.addVehicleLink} onPress={() => navigation.navigate("DriverOnboarding")}>
              <Ionicons name="add-circle-outline" size={16} color={colors.accentText} />
              <Text style={styles.addVehicleLinkText}>{t("verification.addVehicleLink")}</Text>
            </Pressable>
          )}
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
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionLabel: { ...typography.title, fontSize: 14 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  cardHint: { ...typography.small, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 17 },
  vehicleName: { ...typography.body, fontWeight: "700", fontFamily: FONT.bold, marginBottom: spacing.xs },
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
  addVehicleLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", height: 44, borderRadius: radius.sm, marginTop: spacing.xs },
  addVehicleLinkText: { ...typography.caption, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  downloadButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: colors.border, height: 40, borderRadius: radius.sm, marginTop: spacing.sm },
  downloadButtonText: { ...typography.caption, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  previewNote: { ...typography.small, lineHeight: 16 },
  rcVerifiedHint: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm, lineHeight: 15 },
  statusChip: { alignSelf: "flex-start", paddingVertical: 2, paddingHorizontal: spacing.sm, borderRadius: 999 },
  statusChipGood: { backgroundColor: colors.successBg },
  statusChipBad: { backgroundColor: colors.dangerBg },
  statusChipText: { ...typography.small, fontWeight: "700", fontFamily: FONT.bold },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  detailItem: { width: "47%" },
  detailLabel: { ...typography.small, color: colors.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.3 },
  detailValue: { ...typography.caption, color: colors.textPrimary, fontWeight: "700", fontFamily: FONT.bold, marginTop: 1 },
  // ID-card look: dark title strip (mimicking a document's printed
  // header band) over a light body, rather than another plain settings
  // card — this is the thing a driver might actually screenshot/share.
  idCard: { borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  idHeader: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.textPrimary, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  idHeaderTitle: { ...typography.caption, color: "#FFFFFF", fontWeight: "700", fontFamily: FONT.bold, letterSpacing: 0.5, flex: 1 },
  idVerifiedStamp: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 },
  idVerifiedStampText: { fontSize: 9, fontWeight: "700", fontFamily: FONT.bold, color: colors.success, letterSpacing: 0.4 },
  idBody: { backgroundColor: colors.surface, padding: spacing.md },
  idNumberLabel: { ...typography.small, color: colors.textMuted, fontSize: 10, letterSpacing: 0.5 },
  idNumber: { fontSize: 18, fontWeight: "700", fontFamily: FONT.bold, color: colors.textPrimary, letterSpacing: 1, marginTop: 1 },
});
