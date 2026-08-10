import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { CarLoader } from "../components/CarLoader";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";
import { useScreenView } from "../lib/useScreenView";
import { VEHICLE_REVIEW_SLA_MESSAGE } from "./EditVehicleScreen";

// Same PENDING/APPROVED/REJECTED wording and warning/success/danger
// coloring DocumentUploadScreen's own "Pending review" tag already
// established — a vehicle can't be used to publish a ride (see
// rides.routes.js) until it's APPROVED, so this is the one thing
// worth surfacing on every card, not buried in an edit screen.
function VehicleStatusTag({ item, onNavigate }: { item: any; onNavigate: () => void }) {
  const { status, rejectionReason } = item;
  if (status === "APPROVED") {
    return (
      <View style={[styles.statusTag, styles.statusApproved]}>
        <Ionicons name="checkmark-circle" size={11} color={colors.success} />
        <Text style={[styles.statusTagText, { color: colors.success }]}>Approved</Text>
      </View>
    );
  }
  if (status === "REJECTED") {
    return (
      <Pressable
        style={[styles.statusTag, styles.statusRejected]}
        onPress={() => showAlert("Not approved", rejectionReason || "No reason was given.", [
          { text: "Later", style: "cancel" },
          { text: "Fix and resubmit", onPress: onNavigate },
        ])}
      >
        <Ionicons name="close-circle" size={11} color={colors.danger} />
        <Text style={[styles.statusTagText, { color: colors.danger }]}>Rejected — why?</Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      style={[styles.statusTag, styles.statusPending]}
      onPress={() => showAlert("Pending review", VEHICLE_REVIEW_SLA_MESSAGE)}
    >
      <Ionicons name="time-outline" size={11} color={colors.warning} />
      <Text style={[styles.statusTagText, { color: colors.warning }]}>Pending review</Text>
      <Ionicons name="information-circle-outline" size={12} color={colors.warning} />
    </Pressable>
  );
}

export default function VehicleListScreen({ navigation }: any) {
  useScreenView("VehicleListScreen");
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
    showAlert("Remove vehicle", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteVehicle(id);
            showSuccess("Vehicle removed");
            load();
          } catch (err: any) {
            showError(err.message || "Couldn't remove vehicle");
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={{ ...typography.title, padding: spacing.lg, paddingBottom: spacing.sm }}>Your vehicles</Text>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <CarLoader size="lg" />
        </View>
      ) : error ? (
        <ErrorState message="Couldn't load vehicles." onRetry={load} />
      ) : (
      <FlatList
        style={{ flex: 1 }}
        data={vehicles}
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
        ListEmptyComponent={<EmptyState icon="car-sport-outline" title="No vehicles added yet" />}
      />
      )}

      <Pressable style={styles.addButton} onPress={() => navigation.navigate("DriverOnboarding")}>
        <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
        <Text style={styles.addButtonText}>Add vehicle</Text>
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
  statusTagText: { ...typography.small, fontWeight: "700" },
  statusPending: { backgroundColor: colors.warningBg },
  statusApproved: { backgroundColor: colors.successBg },
  statusRejected: { backgroundColor: colors.dangerBg },
  addButton: { flexDirection: "row", gap: spacing.xs, backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", margin: spacing.lg },
  addButtonText: { ...typography.title, color: "#FFFFFF" },
});
