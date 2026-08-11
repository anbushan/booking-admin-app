import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { primeLocationIfNeeded } from "../lib/locationPriming";
import { Analytics } from "../lib/analytics";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";
import { CarLoader } from "../components/CarLoader";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { BackHeader } from "../components/BackHeader";
import { dialProxyNumber } from "../lib/callHelper";
import { useScreenView } from "../lib/useScreenView";
import Avatar from "../components/Avatar";
import { useTranslation } from "../lib/i18n/I18nContext";

export default function StartTripScreen({ route, navigation }: any) {
  useScreenView("StartTripScreen");
  const { t } = useTranslation();
  const { bookingId } = route.params;
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [arriving, setArriving] = useState(true);
  const [arriveFailed, setArriveFailed] = useState(false);
  const [passengerName, setPassengerName] = useState(t("startTrip.passengerFallback"));
  const [passengerPhoto, setPassengerPhoto] = useState<string | null>(null);
  const [passengerRating, setPassengerRating] = useState<number | null>(null);
  const [calling, setCalling] = useState(false);
  const { showError } = useToast();

  useEffect(() => {
    let cancelled = false;
    // Entering this screen IS "I've arrived" — it generates the pickup
    // code server-side and notifies the passenger, who reads it back to
    // you below. Previously this step was never triggered from anywhere,
    // so the code the driver typed here could never match (nothing had
    // generated one yet).
    //
    // Both calls are awaited together before leaving the "arriving"
    // state: this used to flip to the verify-pickup form as soon as
    // startTrip's own promise settled, regardless of whether the
    // passenger's name had loaded yet — a driver with a slow connection
    // routinely saw "Letting your passenger know..." (the placeholder)
    // the whole time, because getBookingDetail's result arrived after
    // the arriving card had already unmounted and had nowhere left to
    // render into. Waiting for both means the name is always in by the
    // time either message needs it.
    Promise.allSettled([api.startTrip(bookingId), api.getBookingDetail(bookingId)]).then(
      ([startResult, detailResult]) => {
        if (cancelled) return;
        if (detailResult.status === "fulfilled") {
          const booking = detailResult.value;
          if (booking.passenger?.name) setPassengerName(booking.passenger.name);
          if (booking.passenger?.photoViewUrl) setPassengerPhoto(booking.passenger.photoViewUrl);
          if (booking.passenger?.ratingAvg != null) setPassengerRating(booking.passenger.ratingAvg);
        }
        if (startResult.status === "rejected") {
          // Previously this silently fell through to the verify-pickup
          // form even on failure — the passenger was never actually
          // notified and no OTP exists server-side yet, so any code the
          // driver typed next was guaranteed to fail with a confusing
          // error. Surface the failure and offer a retry instead.
          setArriveFailed(true);
          showAlert(t("startTrip.couldntNotifyAlert"), (startResult.reason as any)?.message);
        }
        setArriving(false);
      }
    );
    return () => { cancelled = true; };
  }, [bookingId]);

  function retryArrival() {
    setArriveFailed(false);
    setArriving(true);
    api
      .startTrip(bookingId)
      .then(() => setArriving(false))
      .catch((err: any) => {
        setArriveFailed(true);
        setArriving(false);
        showAlert(t("startTrip.couldntNotifyAlert"), err.message);
      });
  }

  async function handleStart() {
    setVerifying(true);
    try {
      await api.verifyTripOtp(bookingId, code.trim());
      Analytics.tripStarted(bookingId);
      await primeLocationIfNeeded(navigation, "ActiveTrip", { bookingId, role: "DRIVER" });
    } catch (err: any) {
      showAlert(t("startTrip.couldntStartTrip"), err.message);
    } finally {
      setVerifying(false);
    }
  }

  async function handleCall() {
    setCalling(true);
    try {
      const { proxyNumber } = await api.initiateCall(bookingId, "PASSENGER");
      await dialProxyNumber(proxyNumber);
    } catch (err: any) {
      showError(err.message || t("common.couldntStartCall"));
    } finally {
      setCalling(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("startTrip.title")} onBack={() => navigation.goBack()} />
      <KeyboardAvoider style={styles.centerContent}>
        {arriving ? (
          <View style={styles.arrivingCard}>
            <CarLoader size="md" />
            <Text style={styles.arrivingText}>{t("startTrip.lettingKnow", { name: passengerName })}</Text>
          </View>
        ) : arriveFailed ? (
          <View style={styles.arrivingCard}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
            <Text style={styles.arrivingText}>{t("startTrip.couldntNotifyName", { name: passengerName })}</Text>
            <Text style={styles.subtitle}>{t("startTrip.checkConnection")}</Text>
            <Pressable style={styles.button} onPress={retryArrival}>
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>{t("startTrip.retry")}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.brandIcon}>
              <Ionicons name="key-outline" size={24} color={colors.accentText} />
            </View>
            <Text style={styles.title}>{t("startTrip.verifyPickup")}</Text>
            <Text style={styles.subtitle}>{t("startTrip.askForCode", { name: passengerName })}</Text>

            <View style={styles.inputWrap}>
              <Ionicons name="keypad-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t("startTrip.otpPlaceholder")}
                placeholderTextColor={colors.textMuted}
                value={code}
                onChangeText={setCode}
                autoFocus
              />
            </View>

            <View style={styles.passengerBar}>
              <Avatar uri={passengerPhoto} name={passengerName} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={styles.passengerName}>{passengerName}</Text>
                {passengerRating != null && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={11} color={colors.warning} />
                    <Text style={styles.passengerMeta}>{passengerRating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
              <Pressable style={styles.callButton} onPress={handleCall} disabled={calling} hitSlop={4}>
                <Ionicons name="call-outline" size={17} color={colors.accentText} />
              </Pressable>
            </View>

            <Pressable style={styles.button} onPress={handleStart} disabled={verifying || code.trim().length < 4}>
              {!verifying && <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
              <Text style={styles.buttonText}>{verifying ? t("startTrip.starting") : t("upcomingTrips.startTrip")}</Text>
            </Pressable>
          </>
        )}
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centerContent: { flex: 1, padding: spacing.lg, justifyContent: "center", alignItems: "center" },
  arrivingCard: { alignItems: "center", gap: spacing.md },
  arrivingText: { ...typography.title, textAlign: "center" },
  brandIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentBg,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  title: { ...typography.title, fontSize: 18, textAlign: "center" },
  subtitle: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: 4, marginBottom: spacing.lg, lineHeight: 18, maxWidth: 280 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, width: "100%",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, height: 50, paddingHorizontal: spacing.md, marginBottom: spacing.md,
  },
  input: { flex: 1, ...typography.body, letterSpacing: 1, color: colors.textPrimary },
  passengerBar: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, width: "100%",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg,
  },
  passengerName: { ...typography.body, fontWeight: "700" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  passengerMeta: { ...typography.small, color: colors.textMuted },
  callButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  button: {
    flexDirection: "row", gap: spacing.xs,
    backgroundColor: colors.textPrimary, height: 48, borderRadius: radius.sm,
    alignItems: "center", justifyContent: "center", width: "100%",
  },
  buttonText: { ...typography.title, color: "#FFFFFF" },
});
