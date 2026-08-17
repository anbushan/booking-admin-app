import React, { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonAvatarRowList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { VerificationBanner } from "../components/VerificationBanner";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

type VehicleRow = {
  id: string;
  make: string;
  model: string;
  regNumber: string;
  color: string | null;
  seatCapacity: number;
  status: string;
  rejectionReason: string | null;
  verification: { rcStatus: string } | null;
};

export default function VehicleListScreen({ navigation }: any) {
  useScreenView("VehicleListScreen");
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  // Driver-level Eko verification (license) — separate from each
  // vehicle's own RC verification shown per-card below. null while
  // unknown, so the banner doesn't flash before the first fetch resolves.
  const [licenseStatus, setLicenseStatus] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    // One call covers both this screen's needs — the same endpoint
    // VerifyDriverScreen uses already returns every vehicle with its
    // RC verification state attached, so there's no separate plain
    // vehicle-list fetch to keep in sync with it.
    api.getVerificationStatus()
      .then((data: any) => {
        setVehicles(data.vehicles);
        setLicenseStatus(data.driverVerification?.licenseStatus || "UNVERIFIED");
      })
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setRefreshing(false); });
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
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("vehicle.yourVehicles")} onBack={() => navigation.goBack()} />

      {/* Driver-level Eko verification — separate from (and faster than)
          the per-vehicle RC badges below. Verified once, this reads the
          same regardless of which vehicle is currently focused, since a
          license isn't tied to any one of them. */}
      {licenseStatus != null && (
        <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          <VerificationBanner verified={licenseStatus === "VERIFIED"} onPress={() => navigation.navigate("VerifyDriver")} />
        </View>
      )}

      {loading ? (
        <SkeletonAvatarRowList count={3} />
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
        renderItem={({ item }) => {
          // Either path counts — a vehicle already APPROVED by an admin
          // under the old manual-review flow reads as verified too, same
          // OR-logic as the driver-level badge (lib/verification.js).
          const rcVerified = item.verification?.rcStatus === "VERIFIED" || item.status === "APPROVED";
          return (
            <View style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons name="car-sport-outline" size={20} color={colors.accentText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.make} {item.model}</Text>
                <Text style={styles.meta}>
                  {item.regNumber}{item.color ? ` · ${item.color}` : ""} · {t("common.seatsCount", { count: item.seatCapacity })}
                </Text>
                <View style={styles.badgeRow}>
                  {item.status === "REJECTED" ? (
                    <Pressable
                      style={styles.rejectedTag}
                      onPress={() => showAlert(t("vehicle.notApproved"), item.rejectionReason || t("vehicle.noReasonGiven"))}
                    >
                      <Ionicons name="close-circle" size={11} color={colors.danger} />
                      <Text style={styles.rejectedTagText}>{t("vehicle.rejectedWhy")}</Text>
                    </Pressable>
                  ) : (
                    <Pressable disabled={rcVerified} onPress={() => navigation.navigate("VerifyDriver")}>
                      <VerifiedBadge verified={rcVerified} size="sm" />
                    </Pressable>
                  )}
                </View>
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
          );
        }}
        ListEmptyComponent={<EmptyState icon="car-sport-outline" title={t("vehicle.noVehiclesYet")} />}
      />
      )}

      <Pressable style={styles.addButton} onPress={() => navigation.navigate("DriverOnboarding")}>
        <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
        <Text style={styles.addButtonText}>{t("vehicle.addVehicle")}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, flexDirection: "row", gap: spacing.sm, alignItems: "center",
  },
  iconWrap: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" },
  iconButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  name: { ...typography.title, fontSize: 14 },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  badgeRow: { flexDirection: "row", marginTop: spacing.xs },
  rejectedTag: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", backgroundColor: colors.dangerBg, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999 },
  rejectedTagText: { ...typography.small, color: colors.danger, fontWeight: "700", fontFamily: FONT.bold },
  addButton: { flexDirection: "row", gap: spacing.xs, backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", margin: spacing.lg },
  addButtonText: { ...typography.title, color: "#FFFFFF" },
});
