import React, { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";

export default function VehicleListScreen({ navigation }: any) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const { showSuccess, showError } = useToast();

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
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>Your vehicles</Text>
      </View>

      {loading ? (
        <SkeletonList count={2} />
      ) : error ? (
        <ErrorState message="Couldn't load vehicles." onRetry={load} />
      ) : (
      <FlatList
        data={vehicles}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View>
              <Text style={styles.name}>{item.make} {item.model}</Text>
              <Text style={styles.meta}>{item.regNumber} {item.color ? `· ${item.color}` : ""}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <Pressable onPress={() => navigation.navigate("EditVehicle", { vehicle: item })}>
                <Text style={styles.editLink}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => handleDelete(item.id)}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyState title="No vehicles added yet" />}
      />
      )}

      <Pressable style={styles.addButton} onPress={() => navigation.navigate("DriverOnboarding")}>
        <Text style={styles.addButtonText}>Add vehicle</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  back: { fontSize: 18 },
  title: typography.title,
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { ...typography.title, fontSize: 14 },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  remove: { ...typography.small, color: colors.danger },
  editLink: { ...typography.small, color: colors.accentText },
  empty: { textAlign: "center", marginTop: spacing.xl, color: colors.textMuted },
  addButton: { backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", margin: spacing.lg },
  addButtonText: { color: "#FFFFFF", ...typography.title },
});
