import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";

export function ProfileScreen({ navigation }: any) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    api.getMyProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  if (!profile) return <SafeAreaView style={styles.screen} edges={["top"]} />;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>Profile</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile.name || "?")[0]}</Text>
        </View>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.meta}>{profile.phone}</Text>
        <Text style={styles.meta}>{profile.role === "DRIVER" ? "Driver" : "Passenger"}</Text>
        {profile.ratingAvg && (
          <Text style={styles.rating}>{profile.ratingAvg.toFixed(1)} rating</Text>
        )}
        <Pressable
          style={styles.editButton}
          onPress={() => navigation.navigate("EditProfile", { profile })}
        >
          <Text style={styles.editButtonText}>Edit profile</Text>
        </Pressable>
      </View>
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
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>Edit profile</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Pressable style={styles.editButton} onPress={handleSave} disabled={submitting}>
          <Text style={styles.editButtonText}>{submitting ? "Saving..." : "Save"}</Text>
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
  body: { padding: spacing.lg, alignItems: "center" },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  avatarText: { fontSize: 24, fontWeight: "500", color: colors.accentText },
  name: { ...typography.title, fontSize: 16, marginTop: spacing.md },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  rating: { ...typography.caption, color: colors.warning, marginTop: 4 },
  editButton: { backgroundColor: colors.textPrimary, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.lg, alignSelf: "stretch" },
  editButtonText: { color: "#FFFFFF", ...typography.title },
  label: { ...typography.caption, color: colors.textSecondary, alignSelf: "flex-start", marginTop: spacing.md, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, height: 44, paddingHorizontal: spacing.md, alignSelf: "stretch" },
});
