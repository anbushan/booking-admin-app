import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Linking } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { checkPushPermission } from "../lib/pushNotifications";
import { logout } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";
import { api } from "../lib/api";

export function SettingsScreen({ navigation }: any) {
  const [pushGranted, setPushGranted] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    checkPushPermission().then(setPushGranted);
    api.getMyProfile().then(setProfile).catch(() => {});
  }, []);

  const rows: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }[] = [
    { label: "Profile", icon: "person-outline", onPress: () => navigation.navigate("Profile") },
    { label: "Your ratings", icon: "star-outline", onPress: () => navigation.navigate("RatingsReceived") },
    { label: "Payment history", icon: "receipt-outline", onPress: () => navigation.navigate("PaymentHistory") },
    { label: "Emergency contacts", icon: "shield-checkmark-outline", onPress: () => navigation.navigate("EmergencyContacts") },
    { label: "Language", icon: "language-outline", onPress: () => navigation.navigate("LanguageSelection") },
    { label: "Notifications", icon: "notifications-outline", onPress: () => navigation.navigate("Notifications") },
    { label: "Help & support", icon: "help-circle-outline", onPress: () => navigation.navigate("HelpSupport") },
    { label: "About & terms", icon: "document-text-outline", onPress: () => navigation.navigate("About") },
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
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>Settings</Text>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {!pushGranted && (
          <Pressable
            style={styles.banner}
            onPress={() => Linking.openSettings()}
          >
            <Ionicons name="notifications-off-outline" size={16} color={colors.warning} />
            <Text style={styles.bannerText}>
              Notifications are off — you may miss booking updates. Tap to enable in Settings.
            </Text>
          </Pressable>
        )}

        <View style={styles.list}>
          {rows.map((row) => (
            <Pressable key={row.label} style={styles.row} onPress={row.onPress}>
              <View style={styles.rowIconWrap}>
                <Ionicons name={row.icon} size={17} color={colors.accentText} />
              </View>
              <Text style={styles.rowText}>{row.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={17} color={colors.danger} />
          <Text style={styles.logoutButtonText}>Log out</Text>
        </Pressable>
      </ScrollView>
      <AppBottomNav navigation={navigation} profile={profile} active="menu" />
    </SafeAreaView>
  );
}

export function HelpSupportScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>Help & support</Text>
      <View style={styles.body}>
        <Text style={styles.paragraph}>
          Need help with a booking, payment, or safety concern? Reach out
          and we'll get back to you as soon as possible.
        </Text>
        <Pressable style={styles.contactRow} onPress={() => Linking.openURL("mailto:support@carpool.app")}>
          <Ionicons name="mail-outline" size={16} color={colors.accentText} />
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
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>About & terms</Text>
      <View style={styles.body}>
        <Text style={styles.paragraph}>NanbaGO v0.1.0</Text>
        <Pressable style={styles.linkRow} onPress={() => Linking.openURL("https://example.com/terms")}>
          <Ionicons name="document-outline" size={15} color={colors.accentText} />
          <Text style={styles.link}>Terms of Service</Text>
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => Linking.openURL("https://example.com/privacy")}>
          <Ionicons name="lock-closed-outline" size={15} color={colors.accentText} />
          <Text style={styles.link}>Privacy Policy</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.warningBg, padding: spacing.md, margin: spacing.md, borderRadius: radius.sm },
  bannerText: { ...typography.caption, color: colors.warning, flex: 1 },
  list: { padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  rowIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  rowText: { ...typography.body, flex: 1 },
  logoutButton: { flexDirection: "row", gap: spacing.xs, margin: spacing.lg, alignItems: "center", justifyContent: "center", padding: spacing.md },
  logoutButtonText: { ...typography.body, color: colors.danger },
  body: { padding: spacing.lg, gap: spacing.md },
  paragraph: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md },
  contactText: { ...typography.body, color: colors.accentText },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  link: { ...typography.body, color: colors.accentText },
});
