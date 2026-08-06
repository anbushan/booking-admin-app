import React, { useRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api, setAuthToken } from "../lib/api";
import { setupPushNotifications } from "../lib/pushNotifications";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";

export function PhoneEntryScreen({ navigation }: any) {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  async function handleSendOtp() {
    if (!/^\d{10}$/.test(phone)) {
      showAlert("Invalid number", "Enter a 10-digit mobile number.");
      return;
    }
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

  return (
    // No back button here — this screen is reached via navigation.replace()
    // from Splash/Onboarding (see SplashOnboardingScreens.tsx), so there's
    // no previous screen in the stack to return to.
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.centerContent}>
        <Text style={styles.title}>Enter your mobile number</Text>
        <TextInput
          ref={inputRef}
          style={styles.input}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="10-digit mobile number"
          placeholderTextColor={colors.textMuted}
          value={phone}
          onChangeText={setPhone}
        />
        <Pressable style={styles.button} onPress={handleSendOtp} disabled={sending}>
          <Text style={styles.buttonText}>{sending ? "Sending..." : "Send OTP"}</Text>
        </Pressable>
        <Pressable style={styles.signupLink} onPress={() => inputRef.current?.focus()}>
          <Text style={styles.signupLinkText}>
            New to Carpool? <Text style={styles.signupLinkAccent}>Sign up</Text> — same number, same step.
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// Same screen handles both signup and login — the backend decides which
// based on whether the phone number already has a User record.
export function OtpVerifyScreen({ route, navigation }: any) {
  const { phone } = route.params;
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function handleVerify() {
    setVerifying(true);
    try {
      const result = await api.verifyOtp(phone, otp);
      await setAuthToken(result.token);
      // Request push permission right after a successful login — natural
      // point in the flow, and registerDevice(null) still fires if the
      // user declines, so the backend knows not to attempt push.
      setupPushNotifications().catch(() => {});
      Analytics.login();
      navigation.reset({
        index: 0,
        routes: [{ name: result.isNewUser ? "Register" : "Home" }],
      });
    } catch (err: any) {
      showAlert("Verification failed", err.message);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.back}>{"<"}</Text>
      </Pressable>
      <View style={styles.centerContent}>
        <Text style={styles.title}>Enter the OTP sent to {phone}</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="6-digit code"
          placeholderTextColor={colors.textMuted}
          value={otp}
          onChangeText={setOtp}
        />
        <Pressable style={styles.button} onPress={handleVerify} disabled={verifying}>
          <Text style={styles.buttonText}>{verifying ? "Verifying..." : "Verify"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  backButton: { padding: spacing.lg },
  back: { fontSize: 18 },
  centerContent: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  title: { ...typography.title, marginBottom: spacing.lg, textAlign: "center" },
  signupLink: { marginTop: spacing.lg, alignItems: "center" },
  signupLinkText: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
  signupLinkAccent: { color: colors.accentText, fontWeight: "500" },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    height: 46,
    paddingHorizontal: spacing.md,
    textAlign: "center",
    fontSize: 18,
    letterSpacing: 4,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#FFFFFF", ...typography.title },
});
