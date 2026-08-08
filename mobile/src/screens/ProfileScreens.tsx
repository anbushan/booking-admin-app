import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "../components/AppHeader";
import { AppBottomNav } from "../components/AppBottomNav";
import { CarLoader } from "../components/CarLoader";

function memberSince(createdAt?: string) {
  if (!createdAt) return null;
  return new Date(createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function ProfileScreen({ navigation }: any) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    api.getMyProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  if (!profile) {
    return (
      <SafeAreaView style={[styles.screen, { alignItems: "center", justifyContent: "center" }]} edges={["top"]}>
        <CarLoader />
      </SafeAreaView>
    );
  }

  const isDriver = profile.role === "DRIVER";
  const since = memberSince(profile.createdAt);

  const links: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[] = [
    { icon: "pencil-outline", label: "Edit profile", onPress: () => navigation.navigate("EditProfile", { profile }) },
    { icon: "star-outline", label: "Your ratings", onPress: () => navigation.navigate("RatingsReceived") },
    { icon: "receipt-outline", label: "Payment history", onPress: () => navigation.navigate("PaymentHistory") },
    ...(isDriver
      ? [
          { icon: "car-sport-outline" as const, label: "My vehicles", onPress: () => navigation.navigate("VehicleList") },
          { icon: "wallet-outline" as const, label: "Earnings", onPress: () => navigation.navigate("Earnings") },
        ]
      : []),
    { icon: "settings-outline", label: "Settings", onPress: () => navigation.navigate("Settings") },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <AppHeader title="Profile" />
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
            <Text style={styles.avatarText}>{(profile.name || "?")[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{profile.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="call-outline" size={13} color="rgba(255,255,255,0.75)" />
            <Text style={styles.meta}>{profile.phone}</Text>
          </View>

          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Ionicons name={isDriver ? "car-sport-outline" : "person-outline"} size={12} color="#FFFFFF" />
              <Text style={styles.chipText}>{isDriver ? "Driver" : "Passenger"}</Text>
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
                <Text style={styles.chipText}>Since {since}</Text>
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
      <AppBottomNav navigation={navigation} profile={profile} active="menu" />
    </SafeAreaView>
  );
}

export function EditProfileScreen({ route, navigation }: any) {
  const { profile } = route.params;
  const [name, setName] = useState(profile.name || "");
  const [email, setEmail] = useState(profile.email || "");
  const [submitting, setSubmitting] = useState(false);
  const { showSuccess } = useToast();

  async function handleSave() {
    setSubmitting(true);
    try {
      await api.updateProfile({ name, email, role: profile.role });
      showSuccess("Profile updated");
      navigation.goBack();
    } catch (err: any) {
      showAlert("Couldn't save", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <AppHeader title="Edit profile" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Pressable style={styles.editButton} onPress={handleSave} disabled={submitting}>
          <Ionicons name="checkmark-outline" size={16} color="#FFFFFF" />
          <Text style={styles.editButtonText}>{submitting ? "Saving..." : "Save"}</Text>
        </Pressable>
      </View>
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
  avatarText: { fontSize: 26, fontWeight: "600", color: "#FFFFFF" },
  name: { ...typography.title, fontSize: 18, color: "#FFFFFF", marginTop: spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  meta: { ...typography.caption, color: "rgba(255,255,255,0.75)" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.md, justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: radius.sm, paddingVertical: 4, paddingHorizontal: spacing.sm },
  chipText: { ...typography.small, color: "#FFFFFF", fontWeight: "600" },
  list: { padding: spacing.md, gap: spacing.sm, marginTop: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  rowIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  rowText: { ...typography.body, flex: 1 },
  editButton: { flexDirection: "row", gap: spacing.xs, backgroundColor: colors.textPrimary, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.lg, alignSelf: "stretch" },
  editButtonText: { color: "#FFFFFF", ...typography.title },
  label: { ...typography.caption, color: colors.textSecondary, alignSelf: "flex-start", marginTop: spacing.md, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, height: 44, paddingHorizontal: spacing.md, alignSelf: "stretch" },
});
