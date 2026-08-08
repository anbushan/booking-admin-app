import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { Analytics } from "../lib/analytics";
import { validateEmergencyContact } from "../lib/validators";
import { FieldError } from "../components/FieldError";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackButton } from "../components/BackButton";
import { AppHeader } from "../components/AppHeader";
import { AppBottomNav } from "../components/AppBottomNav";

type Contact = { id: string; name: string; phone: string; isPrimary: boolean };

export function EmergencyContactsScreen({ navigation }: any) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    api.getMyProfile().then(setProfile).catch(() => {});
  }, []);

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    api.getEmergencyContacts().then(setContacts).catch(() => setError(true)).finally(() => { setLoading(false); setRefreshing(false); });
  }

  // Reload on focus, not just on mount — otherwise coming back from Add
  // Contact via goBack() leaves the list showing stale data until a
  // manual pull-to-refresh.
  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleDelete(id: string) {
    try {
      await api.deleteEmergencyContact(id);
      showSuccess("Contact removed");
      load();
    } catch (err: any) {
      showError(err.message || "Couldn't remove contact");
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <AppHeader title="Emergency contacts" />

      {loading ? (
        <SkeletonList count={2} />
      ) : error ? (
        <ErrorState message="Couldn't load emergency contacts." onRetry={load} />
      ) : (
      <FlatList
        data={contacts}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.name}>
                {item.name} {item.isPrimary && <Text style={styles.primaryTag}>Primary</Text>}
              </Text>
              <Text style={styles.phone}>{item.phone}</Text>
            </View>
            <Pressable onPress={() => handleDelete(item.id)}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="shield-checkmark-outline"
            title="No emergency contacts yet"
            subtitle="Add a contact so we can reach someone for you in an emergency."
          />
        }
      />
      )}

      <Pressable style={styles.addButton} onPress={() => navigation.navigate("AddEmergencyContact")}>
        <Text style={styles.addButtonText}>Add contact</Text>
      </Pressable>
      <AppBottomNav navigation={navigation} profile={profile} active="menu" />
    </SafeAreaView>
  );
}

export function AddEmergencyContactScreen({ navigation }: any) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { showSuccess } = useToast();

  async function handleSave() {
    const validationErrors = validateEmergencyContact({ name, phone });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      await api.addEmergencyContact({ name, phone, relation, isPrimary });
      Analytics.emergencyContactAdded();
      showSuccess("Contact added");
      navigation.goBack();
    } catch (err: any) {
      showAlert("Couldn't save contact", err.message || "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.title}>Add emergency contact</Text>
      </View>

      <View style={styles.body}>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          placeholder="Name"
          value={name}
          onChangeText={(v) => { setName(v); if (errors.name) setErrors((e) => ({ ...e, name: "" })); }}
        />
        <FieldError message={errors.name} />
        <TextInput
          style={[styles.input, errors.phone && styles.inputError]}
          placeholder="10-digit phone number"
          keyboardType="number-pad"
          maxLength={10}
          value={phone}
          onChangeText={(v) => { setPhone(v); if (errors.phone) setErrors((e) => ({ ...e, phone: "" })); }}
        />
        <FieldError message={errors.phone} />
        <TextInput
          style={styles.input}
          placeholder="Relation (optional)"
          value={relation}
          onChangeText={setRelation}
        />
        <Pressable style={styles.checkboxRow} onPress={() => setIsPrimary(!isPrimary)}>
          <View style={[styles.checkbox, isPrimary && styles.checkboxActive]} />
          <Text style={styles.checkboxLabel}>Set as primary contact</Text>
        </Pressable>
        <Pressable style={styles.addButton} onPress={handleSave} disabled={submitting}>
          <Text style={styles.addButtonText}>{submitting ? "Saving..." : "Save contact"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: { fontSize: 18 },
  title: typography.title,
  body: { padding: spacing.lg, gap: spacing.sm },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: { ...typography.title, fontSize: 14 },
  primaryTag: { ...typography.small, color: colors.accentText, backgroundColor: colors.accentBg, padding: 3, borderRadius: 4 },
  phone: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  remove: { ...typography.small, color: colors.danger },
  empty: { textAlign: "center", marginTop: spacing.xl, color: colors.textMuted, paddingHorizontal: spacing.lg },
  addButton: {
    backgroundColor: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    margin: spacing.lg,
  },
  addButtonText: { color: "#FFFFFF", ...typography.title },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    height: 44,
    paddingHorizontal: spacing.md,
  },
  inputError: { borderColor: colors.danger },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxLabel: typography.caption,
});
