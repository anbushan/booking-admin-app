import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, RefreshControl } from "react-native";
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

export default function VehicleListScreen({ navigation }: any) {
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
  addButton: { flexDirection: "row", gap: spacing.xs, backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", margin: spacing.lg },
  addButtonText: { color: "#FFFFFF", ...typography.title },
});
