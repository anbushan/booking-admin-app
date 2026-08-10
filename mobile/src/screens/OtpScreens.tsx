import React, { useRef, useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api, setAuthToken } from "../lib/api";
import { setupPushNotifications } from "../lib/pushNotifications";
import { Analytics } from "../lib/analytics";
import { useToast } from "../components/Toast";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { SafeAreaView } from "react-native-safe-area-context";

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
  const [phone, setPhone] = useState("");
  const [passcode, setPasscode] = useState("");
  const [mode, setMode] = useState<"otp" | "passcode">("otp");
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

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
      navigation.navigate("OtpVerify", { phone });
    } catch (err: any) {
      showAlert("Couldn't send OTP", err.message);
    } finally {
      setSending(false);
    }
  }

  async function handlePasscodeLogin() {
    setTouched(true);
    if (!isValid || !isPasscodeValid) return;
    setSending(true);
    try {
      const result = await api.verifyPasscode(phone, passcode);
      await completeLogin(result, navigation);
    } catch (err: any) {
      showAlert("Couldn't log in", err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    // No back button here — this screen is reached via navigation.replace()
    // from Splash/Onboarding (see SplashOnboardingScreens.tsx), so there's
    // no previous screen in the stack to return to.
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoider>
        <View style={styles.heroBandTop}>
          <View style={styles.brandIconLg}>
            <Ionicons name="car-sport" size={30} color="#FFFFFF" />
          </View>
          <Text style={styles.brandName}>NanbaGO</Text>
        </View>
        <View style={[styles.centerContent, styles.topAligned]}>
          <Text style={styles.title}>Enter your mobile number</Text>
          <Text style={styles.subtitle}>
            {mode === "otp"
              ? "We'll text you a one-time code to continue — as a driver or a passenger, same first step."
              : "Enter the passcode you downloaded from Settings on this account."}
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
              placeholder="10-digit mobile number"
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
              <Text style={styles.fieldErrorText}>Enter a valid 10-digit mobile number.</Text>
            </View>
          )}

          {mode === "passcode" && (
            <TextInput
              style={styles.passcodeInput}
              keyboardType="number-pad"
              maxLength={PASSCODE_LENGTH}
              placeholder="6-digit passcode"
              placeholderTextColor={colors.textMuted}
              value={passcode}
              onChangeText={(v) => setPasscode(v.replace(/\D/g, "").slice(0, PASSCODE_LENGTH))}
              secureTextEntry
            />
          )}

          {mode === "otp" ? (
            <Pressable style={[styles.button, phone.length !== 10 && styles.buttonDisabled]} onPress={handleSendOtp} disabled={sending || phone.length !== 10}>
              {!sending && <Ionicons name="arrow-forward-circle-outline" size={18} color="#FFFFFF" />}
              <Text style={styles.buttonText}>{sending ? "Sending..." : "Send OTP"}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.button, (phone.length !== 10 || !isPasscodeValid) && styles.buttonDisabled]}
              onPress={handlePasscodeLogin}
              disabled={sending || phone.length !== 10 || !isPasscodeValid}
            >
              {!sending && <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />}
              <Text style={styles.buttonText}>{sending ? "Logging in..." : "Log in"}</Text>
            </Pressable>
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
              {mode === "otp" ? "Log in with passcode instead" : "Use OTP instead"}
            </Text>
          </Pressable>

          {mode === "otp" && (
            <View style={styles.signupLink}>
              <Ionicons name="sparkles-outline" size={13} color={colors.textMuted} />
              <Text style={styles.signupLinkText}>
                New here? <Text style={styles.signupLinkAccent}>Signing up</Text> uses this same number and step —
                you'll choose driver or passenger right after.
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
  const { phone } = route.params;
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
      const result = await api.verifyOtp(phone, code);
      await completeLogin(result, navigation);
    } catch (err: any) {
      showAlert("Verification failed", err.message);
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
      showSuccess("OTP sent again");
    } catch (err: any) {
      showError(err.message || "Couldn't resend the code");
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
            <Ionicons name="chatbox-ellipses-outline" size={24} color={colors.accentText} />
          </View>
          <Text style={styles.title}>Enter the OTP sent to</Text>
          <View style={styles.phoneRow}>
            <Ionicons name="call-outline" size={13} color={colors.accentText} />
            <Text style={styles.phoneText}>+91 {phone}</Text>
          </View>
          {/* The only way back to fix a mistyped number, now that
              there's no back button — easy to miss this was even
              possible without it. */}
          <Pressable onPress={() => navigation.goBack()} hitSlop={6}>
            <Text style={styles.editNumberLink}>Wrong number? Edit</Text>
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
          <Text style={styles.autoVerifyHint}>Verifies automatically once you enter all {OTP_LENGTH} digits</Text>

          <Pressable style={styles.button} onPress={() => handleVerify(otp)} disabled={verifying || otp.length !== OTP_LENGTH}>
            {!verifying && <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
            <Text style={styles.buttonText}>{verifying ? "Verifying..." : "Verify"}</Text>
          </Pressable>

          <Pressable style={styles.resendRow} onPress={handleResend} disabled={cooldown > 0 || resending}>
            <Ionicons
              name="refresh-outline"
              size={14}
              color={cooldown > 0 ? colors.textMuted : colors.accentText}
            />
            <Text style={[styles.resendText, cooldown === 0 && !resending && styles.resendTextActive]}>
              {resending ? "Resending..." : cooldown > 0 ? `Resend OTP in 0:${String(cooldown).padStart(2, "0")}` : "Resend OTP"}
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
  heroBand: { alignItems: "center", paddingTop: spacing.xl, paddingBottom: spacing.lg },
  // Sits right under the safe area, not floating mid-screen — the
  // vertically-centered form below it used to push the logo down with
  // it (centerContent covers the rest of the screen and was previously
  // used alone, with nothing pinning the brand mark above it).
  heroBandTop: { alignItems: "center", paddingTop: spacing.sm, paddingBottom: spacing.md },
  topAligned: { justifyContent: "flex-start", paddingTop: spacing.md },
  brandIconLg: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  brandName: { ...typography.title, fontSize: 18, color: colors.textPrimary },
  centerContent: { flex: 1, padding: spacing.lg, justifyContent: "center", alignItems: "center" },
  brandIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentBg,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.lg,
  },
  title: { ...typography.title, textAlign: "center" },
  subtitle: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: 4, marginBottom: spacing.lg, lineHeight: 18 },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  phoneText: { ...typography.title, color: colors.accentText },
  editNumberLink: { ...typography.small, color: colors.textMuted, textDecorationLine: "underline", marginTop: 4, marginBottom: spacing.lg },
  signupLink: { flexDirection: "row", gap: 6, marginTop: spacing.lg, paddingHorizontal: spacing.sm },
  signupLinkText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 18 },
  signupLinkAccent: { color: colors.accentText, fontWeight: "700" },
  passcodeInput: {
    width: "100%",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, height: 52, marginBottom: spacing.md, paddingHorizontal: spacing.md,
    ...typography.body, color: colors.textPrimary, letterSpacing: 4,
  },
  modeToggle: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "center", marginTop: spacing.md, padding: spacing.xs },
  modeToggleText: { ...typography.small, color: colors.accentText, fontWeight: "700" },
  inputWrap: {
    flexDirection: "row", alignItems: "center", width: "100%",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, height: 52, marginBottom: spacing.xs, paddingHorizontal: spacing.md,
  },
  inputWrapError: { borderColor: colors.danger },
  countryCode: { ...typography.body, color: colors.textSecondary, fontWeight: "700" },
  inputDivider: { width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: spacing.sm },
  plainInput: { flex: 1, ...typography.body, height: 50, fontSize: 16, color: colors.textPrimary },
  fieldErrorRow: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: spacing.sm },
  fieldErrorText: { ...typography.small, color: colors.danger },
  otpRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm, position: "relative" },
  autoVerifyHint: { ...typography.small, color: colors.textMuted, textAlign: "center", marginBottom: spacing.lg },
  otpBox: {
    width: 44, height: 54, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  otpBoxActive: { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.accentBg },
  otpDigit: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  hiddenInput: { position: "absolute", opacity: 0, top: 0, left: 0, right: 0, bottom: 0 },
  button: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.accent,
    height: 50,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { ...typography.title, color: "#FFFFFF" },
  resendRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: spacing.lg, padding: spacing.xs },
  resendText: { ...typography.caption, color: colors.textMuted },
  resendTextActive: { color: colors.accentText, fontWeight: "700" },
});
