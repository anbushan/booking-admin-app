import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";

export default function MapPinConfirmScreen({ route, navigation }: any) {
  const { lat, lng, address, onSelect } = route.params;
  const [position, setPosition] = useState({ lat, lng });
  const [currentAddress, setCurrentAddress] = useState(address);
  const [confirming, setConfirming] = useState(false);

  // Fires when the user drags the map (or the marker) to a new spot —
  // reverse-geocodes the dropped pin so the address label stays accurate.
  async function handleRegionChangeComplete(region: Region) {
    const newLat = region.latitude;
    const newLng = region.longitude;
    setPosition({ lat: newLat, lng: newLng });
    try {
      const result = await api.reverseGeocode(newLat, newLng);
      setCurrentAddress(result.address);
    } catch {
      // Keep the previous address label if reverse geocoding fails —
      // the pin position itself is still valid and usable.
    }
  }

  function handleConfirm() {
    setConfirming(true);
    onSelect?.({ lat: position.lat, lng: position.lng, address: currentAddress });
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title="Confirm location" onBack={() => navigation.goBack()} />
      <View style={styles.mapContainer}>
        <MapView
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onRegionChangeComplete={handleRegionChangeComplete}
        >
          <Marker
            coordinate={{ latitude: position.lat, longitude: position.lng }}
            draggable
            onDragEnd={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              handleRegionChangeComplete({
                latitude,
                longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              });
            }}
          />
        </MapView>
      </View>
      <View style={styles.body}>
        <View style={styles.addressRow}>
          <View style={styles.pinBadge}>
            <Ionicons name="location" size={16} color={colors.marigold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.addressLabel}>Pickup location</Text>
            <Text style={styles.address}>{currentAddress}</Text>
          </View>
        </View>
        <View style={styles.hintRow}>
          <Ionicons name="hand-left-outline" size={13} color={colors.textMuted} />
          <Text style={styles.hint}>Drag the pin to fine-tune the exact spot</Text>
        </View>
        <Pressable style={styles.confirmButton} onPress={handleConfirm} disabled={confirming}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.confirmButtonText}>Confirm location</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  mapContainer: { height: 300 },
  body: { padding: spacing.lg },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  pinBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.marigoldBg, alignItems: "center", justifyContent: "center" },
  addressLabel: { ...typography.caption, color: colors.textSecondary },
  address: { ...typography.title, marginTop: 4 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: spacing.sm },
  hint: { ...typography.small, color: colors.textMuted },
  confirmButton: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.accent,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  confirmButtonText: { color: "#FFFFFF", ...typography.title },
});
