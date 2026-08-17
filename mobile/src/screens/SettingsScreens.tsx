import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Linking, Share } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { checkPushPermission } from "../lib/pushNotifications";
import { logout } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

// Hosted as public (no-auth) pages in the admin app — see
// admin/app/legal/{terms,privacy}/page.tsx — so the same URL works for
// the Play/App Store listing, this screen, and anyone else who needs a
// link to point at.
const TERMS_URL = "https://carpool-admin-gray.vercel.app/legal/terms";
const PRIVACY_URL = "https://carpool-admin-gray.vercel.app/legal/privacy";
const SUPPORT_EMAIL = "anbushanthi001@gmail.com";
// Live today regardless of store status — the marketing site's own
// download page (admin/app/download), which already handles "not on
// the store yet" honestly (see its own STORE_LINKS_READY gate) rather
// than pointing anyone at a broken store listing.
const DOWNLOAD_URL = "https://carpool-admin-gray.vercel.app/download";

// Flip once the app actually has a live Play Store listing — same gate,
// same reasoning as admin/lib/siteContent.ts's STORE_LINKS_READY on the
// download page's store badges. The package ID is already fixed
// (app.json), so enabling this later is a one-line change, no other
// code to touch.
const PLAY_STORE_READY = false;
const ANDROID_PACKAGE = "com.carpool.app";
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

export function SettingsScreen({ navigation }: any) {
  useScreenView("SettingsScreen");
  const { t } = useTranslation();
  const [pushGranted, setPushGranted] = useState(true);

  useEffect(() => {
    checkPushPermission().then(setPushGranted);
  }, []);

  async function handleShare() {
    try {
      await Share.share({ message: t("settings.shareMessage", { url: DOWNLOAD_URL }) });
      Analytics.appShared();
    } catch {
      // Share sheet dismissal throws on some platforms — nothing to
      // recover from, same as every other Pressable that fires a native
      // sheet in this app (see handleCall's cancel handling elsewhere).
    }
  }

  // Your ratings/Payment history/Emergency contacts moved to AccountScreen
  // (the Menu tab's own page) — they applied to either role and were
  // listed there too, so this was a straight duplicate, not a second
  // legitimate path to a role-specific screen.
  const rows: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }[] = [
    { key: "profile", label: t("settings.profile"), icon: "person-outline", onPress: () => navigation.navigate("Profile") },
    { key: "loginPasscode", label: t("settings.loginPasscode"), icon: "key-outline", onPress: () => navigation.navigate("LoginPasscode") },
    { key: "language", label: t("settings.language"), icon: "language-outline", onPress: () => navigation.navigate("LanguageSelection") },
    { key: "notifications", label: t("sideMenu.notifications"), icon: "notifications-outline", onPress: () => navigation.navigate("Notifications") },
    { key: "shareApp", label: t("settings.shareApp"), icon: "share-social-outline", onPress: handleShare },
    // Hidden until PLAY_STORE_READY flips — a "Rate us" row pointing at
    // a store listing that doesn't exist yet would be a dead end, worse
    // than not offering it at all (see PLAY_STORE_READY above).
    ...(PLAY_STORE_READY
      ? [{ key: "rateApp", label: t("settings.rateApp"), icon: "star-half-outline" as const, onPress: () => Linking.openURL(PLAY_STORE_URL) }]
      : []),
    { key: "helpSupport", label: t("settings.helpSupport"), icon: "help-circle-outline", onPress: () => navigation.navigate("HelpSupport") },
    { key: "about", label: t("settings.aboutTerms"), icon: "document-text-outline", onPress: () => navigation.navigate("About") },
  ];

  function handleLogout() {
    showAlert(t("sideMenu.logOut"), t("sideMenu.logOutConfirm"), [
      { text: t("sideMenu.cancel"), style: "cancel" },
      {
        text: t("sideMenu.logOut"),
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
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("settings.title")} onBack={() => navigation.goBack()} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {!pushGranted && (
          <Pressable
            style={styles.banner}
            onPress={() => Linking.openSettings()}
          >
            <Ionicons name="notifications-off-outline" size={16} color={colors.warning} />
            <Text style={styles.bannerText}>{t("settings.pushOffBanner")}</Text>
          </Pressable>
        )}

        <View style={styles.list}>
          {rows.map((row) => (
            <Pressable key={row.key} style={styles.row} onPress={row.onPress}>
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
          <Text style={styles.logoutButtonText}>{t("sideMenu.logOut")}</Text>
        </Pressable>
        <Pressable style={styles.deleteAccountLink} onPress={() => navigation.navigate("DeleteAccount")}>
          <Text style={styles.deleteAccountLinkText}>{t("settings.deleteAccount")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export function HelpSupportScreen({ navigation }: any) {
  useScreenView("HelpSupportScreen");
  const { t } = useTranslation();
  return (
    // "bottom" included — a pushed sub-screen, no AppBottomNav here to
    // pad for the device's own inset the way the hub screens do.
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("settings.helpSupport")} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={styles.paragraph}>{t("settings.helpBody")}</Text>
        <Pressable style={styles.contactRow} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
          <Ionicons name="mail-outline" size={16} color={colors.accentText} />
          <Text style={styles.contactText}>{SUPPORT_EMAIL}</Text>
        </Pressable>
        <Text style={styles.paragraph}>{t("settings.sosHint")}</Text>
      </View>
    </SafeAreaView>
  );
}

export function AboutScreen({ navigation }: any) {
  useScreenView("AboutScreen");
  const { t } = useTranslation();
  return (
    // "bottom" included — same reasoning as HelpSupportScreen above.
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("settings.aboutTerms")} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={styles.paragraph}>NanbaGO v0.1.0</Text>
        <Pressable style={styles.linkRow} onPress={() => Linking.openURL(TERMS_URL)}>
          <Ionicons name="document-outline" size={15} color={colors.accentText} />
          <Text style={styles.link}>{t("settings.termsOfService")}</Text>
        </Pressable>
        <Pressable style={styles.linkRow} onPress={() => Linking.openURL(PRIVACY_URL)}>
          <Ionicons name="lock-closed-outline" size={15} color={colors.accentText} />
          <Text style={styles.link}>{t("settings.privacyPolicy")}</Text>
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
  logoutButton: { flexDirection: "row", gap: spacing.xs, marginHorizontal: spacing.lg, marginTop: spacing.lg, alignItems: "center", justifyContent: "center", padding: spacing.md },
  logoutButtonText: { ...typography.body, color: colors.danger },
  deleteAccountLink: { alignItems: "center", justifyContent: "center", padding: spacing.sm, marginBottom: spacing.lg },
  deleteAccountLinkText: { ...typography.small, color: colors.textMuted, textDecorationLine: "underline" },
  body: { padding: spacing.lg, gap: spacing.md },
  paragraph: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md },
  contactText: { ...typography.body, color: colors.accentText },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  link: { ...typography.body, color: colors.accentText },
});
