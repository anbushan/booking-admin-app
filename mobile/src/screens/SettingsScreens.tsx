import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { checkPushPermission } from "../lib/pushNotifications";
import { logout } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";

export function SettingsScreen({ navigation }: any) {
  const [pushGranted, setPushGranted] = useState(true);

  useEffect(() => {
    checkPushPermission().then(setPushGranted);
  }, []);

  const rows = [
    { label: "Profile", onPress: () => navigation.navigate("Profile") },
    { label: "Your ratings", onPress: () => navigation.navigate("RatingsReceived") },
    { label: "Payment history", onPress: () => navigation.navigate("PaymentHistory") },
    { label: "Emergency contacts", onPress: () => navigation.navigate("EmergencyContacts") },
    { label: "Language", onPress: () => navigation.navigate("LanguageSelection") },
    { label: "Notifications", onPress: () => navigation.navigate("Notifications") },
    { label: "Help & support", onPress: () => navigation.navigate("HelpSupport") },
    { label: "About & terms", onPress: () => navigation.navigate("About") },
  ];

  function handleLogout() {
    showAlert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout();
          Analytics.logout();
          navigation.reset({ index: 0, routes: [{ name: "PhoneEntry" }] });
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      {!pushGranted && (
        <Pressable
          style={styles.banner}
          onPress={() => Linking.openSettings()}
        >
          <Text style={styles.bannerText}>
            Notifications are off — you may miss booking updates. Tap to enable in Settings.
          </Text>
        </Pressable>
      )}

      <View style={styles.list}>
        {rows.map((row) => (
          <Pressable key={row.label} style={styles.row} onPress={row.onPress}>
            <Text style={styles.rowText}>{row.label}</Text>
            <Text style={styles.chevron}>{">"}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Log out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

export function HelpSupportScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>Help & support</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.paragraph}>
          Need help with a booking, payment, or safety concern? Reach out
          and we'll get back to you as soon as possible.
        </Text>
        <Pressable style={styles.contactRow} onPress={() => Linking.openURL("mailto:support@carpool.app")}>
          <Text style={styles.contactText}>support@carpool.app</Text>
        </Pressable>
        <Text style={styles.paragraph}>
          For an active safety emergency, use the SOS button during your
          trip rather than waiting for a support reply.
        </Text>
      </View>
    </SafeAreaView>
  );
}

export function AboutScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>About & terms</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.paragraph}>Carpool v0.1.0</Text>
        <Pressable onPress={() => Linking.openURL("https://example.com/terms")}>
          <Text style={styles.link}>Terms of Service</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL("https://example.com/privacy")}>
          <Text style={styles.link}>Privacy Policy</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  back: { fontSize: 18 },
  title: typography.title,
  banner: { backgroundColor: colors.warningBg, padding: spacing.md, margin: spacing.md, borderRadius: radius.sm },
  bannerText: { ...typography.caption, color: colors.warning },
  list: { padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  rowText: typography.body,
  chevron: { color: colors.textMuted },
  logoutButton: { margin: spacing.lg, alignItems: "center", padding: spacing.md },
  logoutButtonText: { ...typography.body, color: colors.danger },
  body: { padding: spacing.lg, gap: spacing.md },
  paragraph: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },
  contactRow: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md },
  contactText: { ...typography.body, color: colors.accentText },
  link: { ...typography.body, color: colors.accentText, marginTop: spacing.xs },
});
