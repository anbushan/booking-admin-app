import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "../components/Button";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";
import { appEvents } from "../lib/appEvents";

// Web build of MapPinConfirmScreen — see LiveTrackingScreen.web.tsx for why
// react-native-maps can't be imported on web at all. The drag-to-adjust-pin
// interaction has no web fallback here (it needs the actual map), so this
// just confirms the geocoded point as-is.

export default function MapPinConfirmScreen({ route, navigation }: any) {
  useScreenView("MapPinConfirmScreen");
  const { t } = useTranslation();
  // selectFor replaces what used to be an onSelect callback — see
  // MapPinConfirmScreen.tsx's identical comment for why.
  const { lat, lng, address, selectFor } = route.params;
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    setConfirming(true);
    appEvents.emit("location:selected", { selectFor, location: { lat, lng, address } });
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("mapPinConfirm.title")} onBack={() => navigation.goBack()} />
      <View style={styles.mapPlaceholder}>
        <Ionicons name="map-outline" size={28} color={colors.accentText} />
        <Text style={styles.mapPlaceholderText}>{t("mapPinConfirm.notAvailableOnWeb")}</Text>
        <Text style={styles.mapPlaceholderHint}>{t("mapPinConfirm.openInMobileApp")}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.addressRow}>
          <View style={styles.pinBadge}>
            <Ionicons name="location" size={16} color={colors.marigold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.addressLabel}>{t("mapPinConfirm.pickupLocation")}</Text>
            <Text style={styles.address}>{address}</Text>
            <Text style={styles.hint}>{lat.toFixed(5)}, {lng.toFixed(5)}</Text>
          </View>
        </View>
        <Button
          title={t("mapPinConfirm.title")}
          icon="checkmark-circle-outline"
          loading={confirming}
          size="md"
          onPress={handleConfirm}
          style={{ marginTop: spacing.xl }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  mapPlaceholder: { height: 300, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.xs },
  mapPlaceholderText: { ...typography.body, color: colors.accentText, textAlign: "center" },
  mapPlaceholderHint: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
  body: { padding: spacing.lg },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  pinBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.marigoldBg, alignItems: "center", justifyContent: "center" },
  addressLabel: { ...typography.caption, color: colors.textSecondary },
  address: { ...typography.title, marginTop: spacing.xs },
  hint: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
});
