import React, { useRef, useState, useEffect } from "react";
import { View, Text, TextInput, Image, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Button } from "../components/Button";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api, setAuthToken } from "../lib/api";
import { setupPushNotifications } from "../lib/pushNotifications";
import { setErrorTrackingUser } from "../lib/errorTracking";
import { Analytics } from "../lib/analytics";
import { appEvents } from "../lib/appEvents";
import { useToast } from "../components/Toast";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

// Matches the backend's own RESEND_COOLDOWN_SECONDS (auth.routes.js) —
// the resend button becomes tappable exactly when the backend would
// actually accept another request, not a guess.
const RESEND_COOLDOWN_SECONDS = 30;
const OTP_LENGTH = 6;
const PASSCODE_LENGTH = 6;

// Shared by both login paths (OTP verify below, and PhoneEntryScreen's
// passcode mode) — same token storage, push-permission prompt, analytics
// event, and post-login routing either way; only how the phone number
// got verified differs.
async function completeLogin(result: any, navigation: any) {
  await setAuthToken(result.token);
  setupPushNotifications().catch(() => {});
  Analytics.login();
  setErrorTrackingUser(result.user?.id || null);
  // Tells AppSocketBridge to (re)connect right now, rather than waiting
  // for the next app-foreground event — without this, a fresh login
  // partway through a session would sit with no live connection until
  // the app happened to background/foreground once.
  appEvents.emit("auth:login");
  navigation.reset({
    index: 0,
    // Every returning login goes through SwitchRole now, not just the
    // (rarer) case where both a driver and a passenger profile already
    // exist — continuing as your current role is a single tap there
    // (it's shown pre-marked "Current"), and it's also where "use this
    // number as the other role too, for the first time" is offered
    // right at login instead of only being reachable later from the
    // side menu.
    routes: [{
      name: result.isNewUser ? "Register" : "SwitchRole",
      params: result.isNewUser ? undefined : { forced: true },
    }],
  });
}

export function PhoneEntryScreen({ navigation }: any) {
  useScreenView("PhoneEntryScreen");
  const { t } = useTranslation();
  const [phone, setPhone] = useState("");
  const [passcode, setPasscode] = useState("");
  const [mode, setMode] = useState<"otp" | "passcode">("otp");
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  // Default checked — see OtpVerifyScreen's matching state for why this
  // one defaults on where RegisterScreen's own checkbox defaults off.
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const inputRef = useRef<TextInput>(null);
  const passcodeInputRef = useRef<TextInput>(null);

  // Strips anything that isn't a digit — the on-screen numeric keypad
  // already limits normal typing, but paste and autofill can both hand
  // back non-digit characters (spaces, a leading "+91", dashes) that
  // would otherwise sit in the field looking valid-ish while silently
  // never reaching 10 digits.
  function handleChangeText(v: string) {
    setPhone(v.replace(/\D/g, "").slice(0, 10));
  }

  const isValid = /^\d{10}$/.test(phone);
  const showError = touched && phone.length > 0 && !isValid;
  const isPasscodeValid = /^\d{6}$/.test(passcode);

  async function handleSendOtp() {
    setTouched(true);
    if (!isValid) return;
    setSending(true);
    try {
      await api.sendOtp(phone);
      // Carries the checkbox's value forward instead of asking again on
      // the very next screen — asking twice in the same flow is exactly
      // the "repeat" this consolidated onto one screen to avoid.
      navigation.navigate("OtpVerify", { phone, whatsappOptIn });
    } catch (err: any) {
      showAlert(t("auth.couldntSendOtp"), err.message);
    } finally {
      setSending(false);
    }
  }

  async function handlePasscodeLogin() {
    setTouched(true);
    if (!isValid || !isPasscodeValid) return;
    setSending(true);
    try {
      const result = await api.verifyPasscode(phone, passcode, whatsappOptIn);
      await completeLogin(result, navigation);
    } catch (err: any) {
      showAlert(t("auth.couldntLogIn"), err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    // No back button here — this screen is reached via navigation.replace()
    // from Splash/Onboarding (see SplashOnboardingScreens.tsx), so there's
    // no previous screen in the stack to return to.
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoider style={styles.centerContent}>
        {/* Logo is part of the same centered column as the form now, not
            pinned separately above it — the whole block (brand mark
            through the signup line at the bottom) moves and centers as
            one unit. */}
        <View style={styles.heroBand}>
          <View style={styles.brandIconLg}>
            <Image source={require("../../assets/brand-mark.png")} style={styles.brandIconLgImage} resizeMode="contain" />
          </View>
          <Text style={styles.brandName}>NanbaGO</Text>
        </View>
        <View style={styles.formBlock}>
          <Text style={styles.title}>{t("auth.enterPhone")}</Text>
          <Text style={styles.subtitle}>
            {mode === "otp" ? t("auth.otpSubtitle") : t("auth.passcodeSubtitle")}
          </Text>
          <Pressable
            style={[styles.inputWrap, showError && styles.inputWrapError]}
            onPress={() => inputRef.current?.focus()}
          >
            <Text style={styles.countryCode}>+91</Text>
            <View style={styles.inputDivider} />
            <TextInput
              ref={inputRef}
              style={styles.plainInput}
              keyboardType="number-pad"
              maxLength={10}
              placeholder={t("auth.phonePlaceholder")}
              placeholderTextColor={colors.textMuted}
              value={phone}
              onChangeText={handleChangeText}
              onBlur={() => setTouched(true)}
              textContentType="telephoneNumber"
              autoFocus
            />
            {isValid ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            ) : phone.length > 0 ? (
              <Pressable onPress={() => { setPhone(""); inputRef.current?.focus(); }} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </Pressable>
          {showError && (
            <View style={styles.fieldErrorRow}>
              <Ionicons name="alert-circle-outline" size={13} color={colors.danger} />
              <Text style={styles.fieldErrorText}>{t("auth.phoneInvalid")}</Text>
            </View>
          )}

          {mode === "passcode" && (
            // Same segmented-boxes-over-an-invisible-input technique as
            // OtpVerifyScreen's code entry below — was a single plain
            // text field before, looking and feeling like a different,
            // less-considered input than the OTP screen right next to it
            // in the same flow. Digits render as a dot, not the actual
            // number (secureTextEntry's masking, reimplemented per-box
            // since a real TextInput can't mask individual characters
            // that are being drawn by something else).
            <View style={styles.otpRow}>
              {passcode.padEnd(PASSCODE_LENGTH, " ").slice(0, PASSCODE_LENGTH).split("").map((d, i) => (
                <Pressable key={i} onPress={() => passcodeInputRef.current?.focus()}>
                  <View style={[styles.otpBox, i === passcode.length && styles.otpBoxActive]}>
                    <Text style={styles.otpDigit}>{d.trim() ? "•" : ""}</Text>
                  </View>
                </Pressable>
              ))}
              <TextInput
                ref={passcodeInputRef}
                style={styles.hiddenInput}
                keyboardType="number-pad"
                maxLength={PASSCODE_LENGTH}
                value={passcode}
                onChangeText={(v) => setPasscode(v.replace(/\D/g, "").slice(0, PASSCODE_LENGTH))}
                secureTextEntry
                autoFocus
              />
            </View>
          )}

          {/* WhatsApp opt-in — commented out for now (not removed), per
              request: "get WhatsApp update" isn't ready to launch yet.
              whatsappOptIn keeps flowing through to verifyOtp/
              verifyPasscode below at whatever it's defaulted to; re-
              enabling this is just uncommenting the block.
          <Pressable style={styles.checkboxRow} onPress={() => setWhatsappOptIn((v) => !v)}>
            <View style={[styles.checkbox, whatsappOptIn && styles.checkboxChecked]}>
              {whatsappOptIn && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
            </View>
            <Text style={styles.checkboxLabel}>{t("auth.whatsappOptIn")}</Text>
          </Pressable>
          */}

          {mode === "otp" ? (
            <Button
              title={sending ? t("auth.sendingOtp") : t("auth.sendOtp")}
              icon="arrow-forward-circle-outline"
              loading={sending}
              disabled={phone.length !== 10}
              onPress={handleSendOtp}
            />
          ) : (
            <Button
              title={sending ? t("auth.loggingIn") : t("auth.logIn")}
              icon="log-in-outline"
              loading={sending}
              disabled={phone.length !== 10 || !isPasscodeValid}
              onPress={handlePasscodeLogin}
            />
          )}

          {/* Only makes sense once a passcode has actually been
              generated (Settings > Login passcode, requires being
              logged in first) — offering it unconditionally here would
              be a dead end for the far more common brand-new-number
              case, so it's a quiet toggle, not a competing primary
              action next to Send OTP. */}
          <Pressable onPress={() => setMode(mode === "otp" ? "passcode" : "otp")} hitSlop={6} style={styles.modeToggle}>
            <Ionicons name={mode === "otp" ? "key-outline" : "chatbox-ellipses-outline"} size={13} color={colors.accentText} />
            <Text style={styles.modeToggleText}>
              {mode === "otp" ? t("auth.usePasscodeInstead") : t("auth.useOtpInstead")}
            </Text>
          </Pressable>

          {mode === "otp" && (
            <View style={styles.signupLink}>
              <Ionicons name="sparkles-outline" size={13} color={colors.textMuted} />
              <Text style={styles.signupLinkText}>
                {t("auth.signupHintPrefix")}<Text style={styles.signupLinkAccent}>{t("auth.signupHintAccent")}</Text>{t("auth.signupHintSuffix")}
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

// Same screen handles both signup and login — the backend decides which
// based on whether the phone number already has a User record.
export function OtpVerifyScreen({ route, navigation }: any) {
  useScreenView("OtpVerifyScreen");
  const { t } = useTranslation();
  // whatsappOptIn was already asked and answered on PhoneEntryScreen,
  // carried forward here rather than asked a second time in the same
  // flow — falls back to checked if this screen is ever reached some
  // other way that skipped that step.
  const { phone, whatsappOptIn = true } = route.params;
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const { showSuccess, showError } = useToast();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0]);

  async function handleVerify(code: string) {
    setVerifying(true);
    try {
      const result = await api.verifyOtp(phone, code, whatsappOptIn);
      await completeLogin(result, navigation);
    } catch (err: any) {
      showAlert(t("auth.verificationFailed"), err.message);
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await api.sendOtp(phone);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      showSuccess(t("auth.otpResent"));
    } catch (err: any) {
      showError(err.message || t("auth.couldntResend"));
    } finally {
      setResending(false);
    }
  }

  const digits = otp.padEnd(OTP_LENGTH, " ").slice(0, OTP_LENGTH).split("");

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoider>
        <View style={styles.centerContent}>
          <View style={styles.brandIcon}>
            <Image source={require("../../assets/brand-mark.png")} style={styles.brandIconImage} resizeMode="contain" />
          </View>
          <Text style={styles.title}>{t("auth.enterOtp")}</Text>
          <View style={styles.phoneRow}>
            <Ionicons name="call-outline" size={13} color={colors.accentText} />
            <Text style={styles.phoneText}>+91 {phone}</Text>
          </View>
          {/* The only way back to fix a mistyped number, now that
              there's no back button — easy to miss this was even
              possible without it. */}
          <Pressable onPress={() => navigation.goBack()} hitSlop={6}>
            <Text style={styles.editNumberLink}>{t("auth.wrongNumberEdit")}</Text>
          </Pressable>

          {/* Segmented boxes are purely visual — the actual keystrokes
              (and SMS/QuickType autofill) are captured by the real,
              invisible TextInput layered on top, same technique every
              native OTP screen uses since RN has no built-in
              segmented-input component. The invisible input covers the
              whole row (not a 1x1 dot off to the side) — Android's IME
              can refuse to reopen the keyboard for a view that small
              once it's been dismissed once, so a real-size tap target
              is what actually makes re-focusing reliable, not just the
              imperative .focus() call. */}
          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <View key={i} style={[styles.otpBox, i === otp.length && styles.otpBoxActive]}>
                <Text style={styles.otpDigit}>{d.trim()}</Text>
              </View>
            ))}
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              value={otp}
              onChangeText={(v) => {
                setOtp(v);
                if (v.length === OTP_LENGTH) handleVerify(v);
              }}
              // OS-level autofill: iOS offers the code from an incoming SMS
              // in the QuickType bar, Android's SMS Retriever fills it
              // in directly — neither needs a native module, just these
              // two props recognized by the platform.
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              autoFocus
            />
          </View>
          <Text style={styles.autoVerifyHint}>{t("auth.autoVerifyHint", { count: OTP_LENGTH })}</Text>

          <Button
            title={verifying ? t("auth.verifying") : t("auth.verify")}
            icon="checkmark-circle-outline"
            loading={verifying}
            disabled={otp.length !== OTP_LENGTH}
            onPress={() => handleVerify(otp)}
          />

          <Pressable style={styles.resendRow} onPress={handleResend} disabled={cooldown > 0 || resending}>
            <Ionicons
              name="refresh-outline"
              size={14}
              color={cooldown > 0 ? colors.textMuted : colors.accentText}
            />
            <Text style={[styles.resendText, cooldown === 0 && !resending && styles.resendTextActive]}>
              {resending ? t("auth.resending") : cooldown > 0 ? t("auth.resendIn", { seconds: String(cooldown).padStart(2, "0") }) : t("auth.resendOtp")}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  backButtonWrap: { padding: spacing.lg, paddingBottom: 0 },
  heroBand: { alignItems: "center", paddingBottom: spacing.lg },
  formBlock: { width: "100%", alignItems: "center" },
  brandIconLg: {
    // White backdrop rather than a colored fill — the real mark already
    // carries its own blue/orange/navy/green, a solid accent circle
    // behind it fights those colors instead of framing them (same
    // reasoning as the splash screen's badge).
    width: 64, height: 64, borderRadius: 20, backgroundColor: "#FFFFFF", padding: spacing.sm,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
    shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4,
  },
  brandIconLgImage: { width: "100%", height: "100%" },
  brandName: { ...typography.titleCompact, color: colors.textPrimary },
  centerContent: { flex: 1, padding: spacing.lg, justifyContent: "center", alignItems: "center" },
  brandIcon: {
    width: 56, height: 56, borderRadius: 18, backgroundColor: "#FFFFFF", padding: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  brandIconImage: { width: "100%", height: "100%" },
  title: { ...typography.title, textAlign: "center" },
  subtitle: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 18 },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  phoneText: { ...typography.title, color: colors.accentText },
  editNumberLink: { ...typography.small, color: colors.textMuted, textDecorationLine: "underline", marginTop: spacing.xs, marginBottom: spacing.lg },
  signupLink: { flexDirection: "row", gap: 6, marginTop: spacing.lg, paddingHorizontal: spacing.sm },
  signupLinkText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 18 },
  signupLinkAccent: { color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md, alignSelf: "flex-start" },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxLabel: { ...typography.caption, color: colors.textSecondary },
  modeToggle: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "center", marginTop: spacing.md, padding: spacing.xs },
  modeToggleText: { ...typography.small, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  inputWrap: {
    flexDirection: "row", alignItems: "center", width: "100%",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, height: 52, marginBottom: spacing.xs, paddingHorizontal: spacing.md,
  },
  inputWrapError: { borderColor: colors.danger },
  countryCode: { ...typography.body, color: colors.textSecondary, fontWeight: "700", fontFamily: FONT.bold },
  inputDivider: { width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: spacing.sm },
  plainInput: { flex: 1, ...typography.body, height: 50, fontSize: 16, color: colors.textPrimary },
  fieldErrorRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", marginBottom: spacing.sm },
  fieldErrorText: { ...typography.small, color: colors.danger },
  otpRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm, position: "relative" },
  autoVerifyHint: { ...typography.small, color: colors.textMuted, textAlign: "center", marginBottom: spacing.lg },
  otpBox: {
    width: 44, height: 54, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  otpBoxActive: { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.accentBg },
  otpDigit: { fontSize: 22, fontWeight: "700", fontFamily: FONT.bold, color: colors.textPrimary },
  hiddenInput: { position: "absolute", opacity: 0, top: 0, left: 0, right: 0, bottom: 0 },
  resendRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: spacing.lg, padding: spacing.xs },
  resendText: { ...typography.caption, color: colors.textMuted },
  resendTextActive: { color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
});
