import React, { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { SkeletonCardList } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

const DAY_LABEL_KEYS = ["searchOptions.day0", "searchOptions.day1", "searchOptions.day2", "searchOptions.day3", "searchOptions.day4", "searchOptions.day5", "searchOptions.day6"];

type Template = {
  id: string;
  sourceAddress: string;
  destAddress: string;
  departureTime: string;
  daysOfWeek: number[];
  active: boolean;
  endDate: string | null;
  upcoming: { id: string; travelDate: string; seatsAvailable: number }[];
};

function daysLabel(daysOfWeek: number[], t: (key: string) => string) {
  const sorted = [...daysOfWeek].sort();
  if (sorted.length === 5 && [1, 2, 3, 4, 5].every((d) => sorted.includes(d))) return t("manageRecurring.weekdays");
  if (sorted.length === 7) return t("manageRecurring.everyDay");
  return sorted.map((d) => t(DAY_LABEL_KEYS[d])).join(", ");
}

export default function ManageRecurringRidesScreen({ navigation }: any) {
  useScreenView("ManageRecurringRidesScreen");
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    setError(false);
    api.getRecurringRides()
      .then(setTemplates)
      .catch(() => setError(true))
      .finally(() => setRefreshing(false));
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleToggleActive(template: Template) {
    setBusyId(template.id);
    try {
      const result = await api.setRecurringRideActive(template.id, !template.active);
      if (!template.active && result.ridesGenerated > 0) {
        showSuccess(t("manageRecurring.resumedToast", { count: result.ridesGenerated }));
      }
      load();
    } catch (err: any) {
      showError(err.message || t("manageRecurring.couldntUpdate"));
    } finally {
      setBusyId(null);
    }
  }

  function handleStop(template: Template) {
    showAlert(t("manageRecurring.stopTitle"), t("manageRecurring.stopBody"), [
      { text: t("sideMenu.cancel"), style: "cancel" },
      {
        text: t("manageRecurring.stopConfirm"),
        style: "destructive",
        onPress: async () => {
          setBusyId(template.id);
          try {
            const result = await api.deleteRecurringRide(template.id);
            showSuccess(
              result.leftForDriver > 0
                ? t("manageRecurring.stoppedWithLeftoverToast", { left: result.leftForDriver })
                : t("manageRecurring.stoppedToast")
            );
            load();
          } catch (err: any) {
            showError(err.message || t("manageRecurring.couldntUpdate"));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("manageRecurring.title")} onBack={() => navigation.goBack()} />

      {templates === null && !error ? (
        <SkeletonCardList />
      ) : error ? (
        <ErrorState message={t("manageRecurring.couldntLoad")} onRetry={() => load()} />
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.accent]} tintColor={colors.accent} />}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState
              icon="repeat-outline"
              title={t("manageRecurring.emptyTitle")}
              subtitle={t("manageRecurring.emptySubtitle")}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.card, !item.active && styles.cardPaused]}>
              <View style={styles.routeRow}>
                <Ionicons name="navigate-outline" size={13} color={colors.textMuted} />
                <Text style={styles.route}>{t("common.routeTo", { source: item.sourceAddress, dest: item.destAddress })}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="repeat" size={12} color={colors.accentText} />
                <Text style={styles.metaText}>{daysLabel(item.daysOfWeek, t)} · {item.departureTime}</Text>
              </View>
              <View style={[styles.statusChip, item.active ? styles.statusChipActive : styles.statusChipPaused]}>
                <Text style={[styles.statusChipText, { color: item.active ? colors.success : colors.textMuted }]}>
                  {item.active ? t("manageRecurring.active") : t("manageRecurring.paused")}
                </Text>
              </View>

              {item.upcoming.length > 0 && (
                <View style={styles.upcomingWrap}>
                  <Text style={styles.upcomingLabel}>{t("manageRecurring.nextRides")}</Text>
                  {item.upcoming.map((ride) => (
                    <Text key={ride.id} style={styles.upcomingDate}>
                      {new Date(ride.travelDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.actionRow}>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => handleToggleActive(item)}
                  disabled={busyId === item.id}
                >
                  <Ionicons name={item.active ? "pause-outline" : "play-outline"} size={14} color={colors.accentText} />
                  <Text style={styles.actionButtonText}>
                    {item.active ? t("manageRecurring.pause") : t("manageRecurring.resume")}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, styles.actionButtonDanger]}
                  onPress={() => handleStop(item)}
                  disabled={busyId === item.id}
                >
                  <Ionicons name="close-circle-outline" size={14} color={colors.danger} />
                  <Text style={[styles.actionButtonText, { color: colors.danger }]}>{t("manageRecurring.stop")}</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  cardPaused: { opacity: 0.7 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  route: { ...typography.title, fontSize: 13, flexShrink: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  metaText: { ...typography.small, color: colors.textSecondary },
  statusChip: { alignSelf: "flex-start", marginTop: spacing.xs, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999 },
  statusChipActive: { backgroundColor: colors.successBg },
  statusChipPaused: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  statusChipText: { ...typography.small, fontWeight: "700", fontFamily: FONT.bold },
  upcomingWrap: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  upcomingLabel: { ...typography.small, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 },
  upcomingDate: { ...typography.caption, color: colors.textSecondary },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionButton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    height: 38, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
  },
  actionButtonDanger: { borderColor: colors.dangerBg },
  actionButtonText: { ...typography.caption, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
});
