import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { SafeAreaView } from "react-native-safe-area-context";

// Web build of MapPinConfirmScreen — see LiveTrackingScreen.web.tsx for why
// react-native-maps can't be imported on web at all. The drag-to-adjust-pin
// interaction has no web fallback here (it needs the actual map), so this
// just confirms the geocoded point as-is.

export default function MapPinConfirmScreen({ route, navigation }: any) {
  const { lat, lng, address, onSelect } = route.params;
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    setConfirming(true);
    onSelect?.({ lat, lng, address });
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapPlaceholderText}>Map preview isn't available on web</Text>
        <Text style={styles.mapPlaceholderHint}>Open this in the mobile app to drag-adjust the pin.</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.addressLabel}>Pickup location</Text>
        <Text style={styles.address}>{address}</Text>
        <Text style={styles.hint}>{lat.toFixed(5)}, {lng.toFixed(5)}</Text>
        <Pressable style={styles.confirmButton} onPress={handleConfirm} disabled={confirming}>
          <Text style={styles.confirmButtonText}>Confirm location</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  mapPlaceholder: { height: 300, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  mapPlaceholderText: { ...typography.body, color: colors.accentText, textAlign: "center" },
  mapPlaceholderHint: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
  body: { padding: spacing.lg },
  addressLabel: { ...typography.caption, color: colors.textSecondary },
  address: { ...typography.title, marginTop: 4 },
  hint: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
  confirmButton: {
    backgroundColor: colors.textPrimary,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  confirmButtonText: { color: "#FFFFFF", ...typography.title },
});
