import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, FlatList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { CarLoader } from "../components/CarLoader";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { Analytics } from "../lib/analytics";
import { validateEmergencyContact } from "../lib/validators";
import { FieldError } from "../components/FieldError";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

type Contact = { id: string; name: string; phone: string; isPrimary: boolean };

export function EmergencyContactsScreen({ navigation }: any) {
  useScreenView("EmergencyContactsScreen");
  const { t } = useTranslation();
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
      showSuccess(t("emergencyContacts.removed"));
      load();
    } catch (err: any) {
      showError(err.message || t("emergencyContacts.couldntRemove"));
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>{t("emergencyContacts.title")}</Text>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message={t("emergencyContacts.couldntLoad")} onRetry={load} />
      ) : (
      <FlatList
        style={{ flex: 1 }}
        data={contacts}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.name}>
                {item.name} {item.isPrimary && <Text style={styles.primaryTag}>{t("emergencyContacts.primary")}</Text>}
              </Text>
              <Text style={styles.phone}>{item.phone}</Text>
            </View>
            <Pressable onPress={() => handleDelete(item.id)}>
              <Text style={styles.remove}>{t("emergencyContacts.remove")}</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="shield-checkmark-outline"
            title={t("emergencyContacts.emptyTitle")}
            subtitle={t("emergencyContacts.emptySubtitle")}
          />
        }
      />
      )}

      <Pressable style={styles.addButton} onPress={() => navigation.navigate("AddEmergencyContact")}>
        <Text style={styles.addButtonText}>{t("emergencyContacts.addContact")}</Text>
      </Pressable>
      <AppBottomNav navigation={navigation} profile={profile} active="menu" />
    </SafeAreaView>
  );
}

export function AddEmergencyContactScreen({ navigation }: any) {
  useScreenView("AddEmergencyContactScreen");
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { showSuccess } = useToast();

  async function handleSave() {
    const validationErrors = validateEmergencyContact({ name, phone }, t);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      await api.addEmergencyContact({ name, phone, relation, isPrimary });
      Analytics.emergencyContactAdded();
      showSuccess(t("emergencyContacts.added"));
      navigation.goBack();
    } catch (err: any) {
      showAlert(t("emergencyContacts.couldntSave"), err.message || t("payment.pleaseTryAgain"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>{t("emergencyContacts.addTitle")}</Text>

      <KeyboardAvoider>
      <View style={styles.body}>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          placeholder={t("emergencyContacts.namePlaceholder")}
          value={name}
          onChangeText={(v) => { setName(v); if (errors.name) setErrors((e) => ({ ...e, name: "" })); }}
        />
        <FieldError message={errors.name} />
        <TextInput
          style={[styles.input, errors.phone && styles.inputError]}
          placeholder={t("emergencyContacts.phonePlaceholder")}
          keyboardType="number-pad"
          maxLength={10}
          value={phone}
          onChangeText={(v) => { setPhone(v); if (errors.phone) setErrors((e) => ({ ...e, phone: "" })); }}
        />
        <FieldError message={errors.phone} />
        <TextInput
          style={styles.input}
          placeholder={t("emergencyContacts.relationPlaceholder")}
          value={relation}
          onChangeText={setRelation}
        />
        <Pressable style={styles.checkboxRow} onPress={() => setIsPrimary(!isPrimary)}>
          <View style={[styles.checkbox, isPrimary && styles.checkboxActive]} />
          <Text style={styles.checkboxLabel}>{t("emergencyContacts.setPrimary")}</Text>
        </Pressable>
        <Pressable style={styles.addButton} onPress={handleSave} disabled={submitting}>
          <Text style={styles.addButtonText}>{submitting ? t("emergencyContacts.saving") : t("emergencyContacts.saveContact")}</Text>
        </Pressable>
      </View>
      </KeyboardAvoider>
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
  addButtonText: { ...typography.title, color: "#FFFFFF" },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
  },
  inputError: { borderColor: colors.danger },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxLabel: typography.caption,
});
