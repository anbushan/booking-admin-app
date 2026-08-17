import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, Image, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { CarLoader } from "../components/CarLoader";
import { useScreenView } from "../lib/useScreenView";
import { pickImage, uploadToSignedUrl } from "../lib/imageUpload";
import { useTranslation } from "../lib/i18n/I18nContext";

function memberSince(createdAt?: string) {
  if (!createdAt) return null;
  return new Date(createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function ProfileScreen({ navigation }: any) {
  useScreenView("ProfileScreen");
  const { t } = useTranslation();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    api.getMyProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  if (!profile) {
    // Same shell as the loaded return below, just a spinner where the
    // profile content will go.
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <BackHeader title={t("settings.profile")} onBack={() => navigation.goBack()} />
        <View style={[{ flex: 1 }, { alignItems: "center", justifyContent: "center" }]}>
          <CarLoader />
        </View>
      </SafeAreaView>
    );
  }

  const isDriver = profile.role === "DRIVER";
  const since = memberSince(profile.createdAt);

  // Your ratings/Payment history moved to AccountScreen (the Menu tab's
  // own page) — listed there too, so this was a straight duplicate.
  const links: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[] = [
    { icon: "pencil-outline", label: t("profile.editProfile"), onPress: () => navigation.navigate("EditProfile", { profile }) },
    // Reachable by any role (an account can be both a driver and a
    // passenger) — purely a trust badge, never required to book, so
    // it's just a settings-style link rather than gated to one role.
    { icon: "shield-checkmark-outline", label: t("verification.passengerLink"), onPress: () => navigation.navigate("VerifyPassenger") },
    ...(isDriver
      ? [
          { icon: "car-sport-outline" as const, label: t("sideMenu.myVehicles"), onPress: () => navigation.navigate("VehicleList") },
          { icon: "wallet-outline" as const, label: t("home.earnings"), onPress: () => navigation.navigate("Earnings") },
        ]
      : []),
    { icon: "settings-outline", label: t("sideMenu.settings"), onPress: () => navigation.navigate("Settings") },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("settings.profile")} onBack={() => navigation.goBack()} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <View style={styles.hero}>
          <Pressable
            style={styles.heroEditButton}
            onPress={() => navigation.navigate("EditProfile", { profile })}
            hitSlop={6}
          >
            <Ionicons name="pencil" size={14} color="#FFFFFF" />
          </Pressable>

          <View style={styles.avatar}>
            {profile.photoViewUrl ? (
              <Image source={{ uri: profile.photoViewUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{(profile.name || "?")[0]?.toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.name}>{profile.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="call-outline" size={13} color="rgba(255,255,255,0.75)" />
            <Text style={styles.meta}>{profile.phone}</Text>
          </View>

          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Ionicons name={isDriver ? "car-sport-outline" : "person-outline"} size={12} color="#FFFFFF" />
              <Text style={styles.chipText}>{isDriver ? t("register.driver") : t("register.passenger")}</Text>
            </View>
            {profile.ratingAvg != null && (
              <View style={styles.chip}>
                <Ionicons name="star" size={12} color={colors.marigold} />
                <Text style={styles.chipText}>{profile.ratingAvg.toFixed(1)}</Text>
              </View>
            )}
            {since && (
              <View style={styles.chip}>
                <Ionicons name="calendar-outline" size={12} color="#FFFFFF" />
                <Text style={styles.chipText}>{t("profile.since", { date: since })}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.list}>
          {links.map((link) => (
            <Pressable key={link.label} style={styles.row} onPress={link.onPress}>
              <View style={styles.rowIconWrap}>
                <Ionicons name={link.icon} size={17} color={colors.accentText} />
              </View>
              <Text style={styles.rowText}>{link.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function EditProfileScreen({ route, navigation }: any) {
  useScreenView("EditProfileScreen");
  const { t } = useTranslation();
  const { profile } = route.params;
  const [name, setName] = useState(profile.name || "");
  const [email, setEmail] = useState(profile.email || "");
  const [whatsappOptIn, setWhatsappOptIn] = useState(!!profile.whatsappOptIn);
  const [photoUri, setPhotoUri] = useState<string | null>(profile.photoViewUrl || null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { showSuccess, showError } = useToast();

  // Uploads immediately on pick, independent of the Save button below —
  // matches AddVehicleScreen's own upload-then-submit-the-rest pattern,
  // and means leaving without tapping Save still keeps a photo you just
  // picked (nothing to lose by not "saving" a photo specifically).
  async function handleChangePhoto() {
    try {
      const picked = await pickImage();
      if (!picked) return;
      setUploadingPhoto(true);
      const { uploadUrl } = await api.getProfilePhotoUploadUrl();
      await uploadToSignedUrl(uploadUrl, picked.uri, picked.mimeType);
      setPhotoUri(picked.uri);
    } catch (err: any) {
      showError(err.message || t("profile.couldntUpdatePhoto"));
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    setSubmitting(true);
    try {
      await api.updateProfile({ name, email, role: profile.role, whatsappOptIn });
      showSuccess(t("profile.profileUpdated"));
      navigation.goBack();
    } catch (err: any) {
      showAlert(t("profile.couldntSave"), err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // "bottom" included — no bottom nav here to pad for the device's
    // own inset itself, so the "Save" button needs its own protection.
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("profile.editProfile")} onBack={() => navigation.goBack()} />
      <KeyboardAvoider>
      <View style={styles.body}>
        <Pressable style={styles.editAvatarWrap} onPress={handleChangePhoto} disabled={uploadingPhoto}>
          <View style={styles.editAvatar}>
            {uploadingPhoto ? (
              <CarLoader size="sm" />
            ) : photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarText, { color: colors.accentText }]}>{(name || "?")[0]?.toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.editAvatarBadge}>
            <Ionicons name="camera" size={13} color="#FFFFFF" />
          </View>
        </Pressable>
        <Text style={styles.changePhotoText}>{photoUri ? t("profile.changePhoto") : t("profile.addPhoto")}</Text>

        <Text style={styles.label}>{t("profile.name")}</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />
        <Text style={styles.label}>{t("profile.email")}</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Pressable style={styles.checkboxRow} onPress={() => setWhatsappOptIn((v) => !v)}>
          <View style={[styles.checkbox, whatsappOptIn && styles.checkboxChecked]}>
            {whatsappOptIn && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
          </View>
          <Text style={styles.checkboxLabel}>{t("auth.whatsappOptIn")}</Text>
        </Pressable>
        <Pressable style={styles.editButton} onPress={handleSave} disabled={submitting}>
          <Ionicons name="checkmark-outline" size={16} color="#FFFFFF" />
          <Text style={styles.editButtonText}>{submitting ? t("register.saving") : t("profile.save")}</Text>
        </Pressable>
      </View>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, alignItems: "center" },
  hero: {
    backgroundColor: colors.textPrimary,
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  heroEditButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 26, fontWeight: "700", fontFamily: FONT.bold, color: "#FFFFFF" },
  avatarImage: { width: "100%", height: "100%", borderRadius: 999 },
  editAvatarWrap: { width: 76, height: 76, marginBottom: spacing.xs },
  editAvatar: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: colors.accentBg,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  editAvatarBadge: {
    position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.textPrimary, borderWidth: 2, borderColor: colors.bg,
    alignItems: "center", justifyContent: "center",
  },
  changePhotoText: { ...typography.small, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold, marginBottom: spacing.sm },
  name: { ...typography.titleCompact, color: "#FFFFFF", marginTop: spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 2 },
  meta: { ...typography.caption, color: "rgba(255,255,255,0.75)" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.md, justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  chipText: { ...typography.small, color: "#FFFFFF", fontWeight: "700", fontFamily: FONT.bold },
  list: { padding: spacing.md, gap: spacing.sm, marginTop: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  rowIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  rowText: { ...typography.body, flex: 1 },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, alignSelf: "stretch" },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxLabel: { ...typography.caption, color: colors.textSecondary },
  editButton: { flexDirection: "row", gap: spacing.xs, backgroundColor: colors.textPrimary, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.lg, alignSelf: "stretch" },
  editButtonText: { ...typography.title, color: "#FFFFFF" },
  label: { ...typography.caption, color: colors.textSecondary, alignSelf: "flex-start", marginTop: spacing.md, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, height: 44, paddingHorizontal: spacing.md, alignSelf: "stretch", color: colors.textPrimary },
});
