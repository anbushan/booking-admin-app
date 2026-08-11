import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { CarLoader } from "../components/CarLoader";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";
import { useScreenView } from "../lib/useScreenView";
import { VEHICLE_REVIEW_SLA_MESSAGE_KEY } from "./EditVehicleScreen";
import { useTranslation } from "../lib/i18n/I18nContext";

// Same PENDING/APPROVED/REJECTED wording and warning/success/danger
// coloring DocumentUploadScreen's own "Pending review" tag already
// established — a vehicle can't be used to publish a ride (see
// rides.routes.js) until it's APPROVED, so this is the one thing
// worth surfacing on every card, not buried in an edit screen.
function VehicleStatusTag({ item, onNavigate }: { item: any; onNavigate: () => void }) {
  const { t } = useTranslation();
  const { status, rejectionReason } = item;
  if (status === "APPROVED") {
    return (
      <View style={[styles.statusTag, styles.statusApproved]}>
        <Ionicons name="checkmark-circle" size={11} color={colors.success} />
        <Text style={[styles.statusTagText, { color: colors.success }]}>{t("vehicle.approved")}</Text>
      </View>
    );
  }
  if (status === "REJECTED") {
    return (
      <Pressable
        style={[styles.statusTag, styles.statusRejected]}
        onPress={() => showAlert(t("vehicle.notApproved"), rejectionReason || t("vehicle.noReasonGiven"), [
          { text: t("vehicle.later"), style: "cancel" },
          { text: t("vehicle.fixAndResubmit"), onPress: onNavigate },
        ])}
      >
        <Ionicons name="close-circle" size={11} color={colors.danger} />
        <Text style={[styles.statusTagText, { color: colors.danger }]}>{t("vehicle.rejectedWhy")}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      style={[styles.statusTag, styles.statusPending]}
      onPress={() => showAlert(t("vehicle.pendingReview"), t(VEHICLE_REVIEW_SLA_MESSAGE_KEY))}
    >
      <Ionicons name="time-outline" size={11} color={colors.warning} />
      <Text style={[styles.statusTagText, { color: colors.warning }]}>{t("vehicle.pendingReview")}</Text>
      <Ionicons name="information-circle-outline" size={12} color={colors.warning} />
    </Pressable>
  );
}

export default function VehicleListScreen({ navigation }: any) {
  useScreenView("VehicleListScreen");
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<any[]>([]);
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
    api.getVehicles().then(setVehicles).catch(() => setError(true)).finally(() => { setLoading(false); setRefreshing(false); });
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleDelete(id: string) {
    showAlert(t("vehicle.removeVehicle"), t("vehicle.areYouSure"), [
      { text: t("sideMenu.cancel"), style: "cancel" },
      {
        text: t("emergencyContacts.remove"),
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteVehicle(id);
            showSuccess(t("vehicle.vehicleRemoved"));
            load();
          } catch (err: any) {
            showError(err.message || t("vehicle.couldntRemove"));
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>{t("vehicle.yourVehicles")}</Text>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message={t("vehicle.couldntLoad")} onRetry={load} />
      ) : (
      <FlatList
        style={{ flex: 1 }}
        data={vehicles}
        maxToRenderPerBatch={10}
        windowSize={8}
        initialNumToRender={10}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="car-sport-outline" size={18} color={colors.accentText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.make} {item.model}</Text>
              <Text style={styles.meta}>{item.regNumber} {item.color ? `· ${item.color}` : ""}</Text>
              <VehicleStatusTag item={item} onNavigate={() => navigation.navigate("EditVehicle", { vehicle: item })} />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable style={styles.iconButton} onPress={() => navigation.navigate("EditVehicle", { vehicle: item })} hitSlop={4}>
                <Ionicons name="pencil-outline" size={16} color={colors.accentText} />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={() => handleDelete(item.id)} hitSlop={4}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="car-sport-outline" title={t("vehicle.noVehiclesYet")} />}
      />
      )}

      <Pressable style={styles.addButton} onPress={() => navigation.navigate("DriverOnboarding")}>
        <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
        <Text style={styles.addButtonText}>{t("vehicle.addVehicle")}</Text>
      </Pressable>
      <AppBottomNav navigation={navigation} profile={profile} active="menu" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  iconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  iconButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  name: { ...typography.title, fontSize: 14 },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  statusTag: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 4, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999 },
  statusTagText: { ...typography.small, fontWeight: "700", fontFamily: FONT.bold },
  statusPending: { backgroundColor: colors.warningBg },
  statusApproved: { backgroundColor: colors.successBg },
  statusRejected: { backgroundColor: colors.dangerBg },
  addButton: { flexDirection: "row", gap: spacing.xs, backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", margin: spacing.lg },
  addButtonText: { ...typography.title, color: "#FFFFFF" },
});
