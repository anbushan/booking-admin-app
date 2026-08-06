import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";

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
    <SafeAreaView style={styles.screen} edges={["top"]}>
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
        <Text style={styles.addressLabel}>Pickup location</Text>
        <Text style={styles.address}>{currentAddress}</Text>
        <Text style={styles.hint}>Drag the pin to fine-tune the exact spot</Text>
        <Pressable style={styles.confirmButton} onPress={handleConfirm} disabled={confirming}>
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
