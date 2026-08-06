import React, { useState } from "react";
import { View, TextInput, FlatList, Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "../components/Toast";

type Suggestion = { placeId: string; description: string };

// Generates a fresh session token per search session — Autocomplete billing
// is per-session, not per-keystroke, as long as the session ends with a
// Place Details call (see plan section 4). Never reuse a token across
// unrelated searches.
function newSessionToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function LocationSearchScreen({ navigation, route }: any) {
  // skipMapConfirm: true bypasses MapPinConfirmScreen (which needs
  // react-native-maps, a native module Expo Go can't load) for callers that
  // only need an approximate point — e.g. Home's ride search — rather than
  // the exact-pin-drop precision a booking's pickup point needs.
  const { onSelect, skipMapConfirm } = route.params || {};
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [sessionToken] = useState(newSessionToken);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const { showError } = useToast();

  async function handleChangeText(text: string) {
    setQuery(text);
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const results = await api.placesAutocomplete(text, sessionToken);
      setSuggestions(results);
    } catch {
      setSuggestions([]);
      showError("Couldn't search locations. Check your connection and try again.");
    }
  }

  async function handleSelect(suggestion: Suggestion) {
    if (resolving) return;
    setResolving(true);
    try {
      // This call terminates the Autocomplete session with a Place Details
      // request — required for the keystroke billing to zero out.
      const details = await api.placesDetails(suggestion.placeId, sessionToken);
      if (skipMapConfirm) {
        onSelect?.({ lat: details.lat, lng: details.lng, address: details.address });
        navigation.goBack();
        return;
      }
      navigation.navigate("MapPinConfirm", {
        lat: details.lat,
        lng: details.lng,
        address: details.address,
        onSelect,
      });
    } catch {
      showError("Couldn't resolve that location. Try again.");
    } finally {
      setResolving(false);
    }
  }

  async function handleUseCurrentLocation() {
    if (locating) return;
    setLocating(true);
    try {
      const loc = await api.getCurrentLocation();
      if (skipMapConfirm) {
        onSelect?.(loc);
        navigation.goBack();
        return;
      }
      navigation.navigate("MapPinConfirm", { ...loc, onSelect });
    } catch (err: any) {
      showError(err?.message || "Couldn't get your current location.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="Search for a location"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={handleChangeText}
          autoFocus
        />
      </View>

      <Pressable style={styles.currentLocationRow} onPress={handleUseCurrentLocation} disabled={locating}>
        {locating ? (
          <ActivityIndicator size="small" color={colors.accentText} />
        ) : (
          <Text style={styles.currentLocationText}>Use current location</Text>
        )}
      </Pressable>

      <FlatList
        data={suggestions}
        keyExtractor={(item) => item.placeId}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => handleSelect(item)}>
            <Text style={styles.rowText}>{item.description}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: { fontSize: 18 },
  input: { flex: 1, ...typography.body, height: 40 },
  currentLocationRow: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  currentLocationText: { ...typography.body, color: colors.accentText },
  row: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: typography.body,
});
