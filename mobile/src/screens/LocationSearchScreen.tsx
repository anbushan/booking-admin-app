import React, { useState } from "react";
import { View, TextInput, FlatList, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "../components/Toast";
import { EmptyState } from "../components/EmptyState";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { useScreenView } from "../lib/useScreenView";
import { getRecentSearches, addRecentSearch, RecentLocation } from "../lib/recentSearches";
import { useTranslation } from "../lib/i18n/I18nContext";

type Suggestion = { placeId: string; description: string };
type PopularLocation = { address: string; lat: number; lng: number; count: number };

// Generates a fresh session token per search session — Autocomplete billing
// is per-session, not per-keystroke, as long as the session ends with a
// Place Details call (see plan section 4). Never reuse a token across
// unrelated searches.
function newSessionToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function LocationSearchScreen({ navigation, route }: any) {
  useScreenView("LocationSearchScreen");
  const { t } = useTranslation();
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
  const [recent, setRecent] = useState<RecentLocation[]>([]);
  const [popular, setPopular] = useState<PopularLocation[]>([]);
  const [listening, setListening] = useState(false);
  const { showError } = useToast();

  // Recent searches are re-read on every focus (a pick made elsewhere
  // this session should show up immediately), popular locations only
  // once — they're a slow-moving, shared list, not worth refetching
  // every time this screen opens.
  useFocusEffect(
    React.useCallback(() => {
      getRecentSearches().then(setRecent);
    }, [])
  );
  React.useEffect(() => {
    api.getPopularLocations().then(setPopular).catch(() => setPopular([]));
  }, []);

  function finishSelection(loc: { lat: number; lng: number; address: string }) {
    addRecentSearch(loc);
    if (skipMapConfirm) {
      onSelect?.(loc);
      navigation.goBack();
      return;
    }
    navigation.navigate("MapPinConfirm", { ...loc, onSelect });
  }

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
      showError(t("locationSearch.couldntSearch"));
    }
  }

  async function handleSelect(suggestion: Suggestion) {
    if (resolving) return;
    setResolving(true);
    try {
      // This call terminates the Autocomplete session with a Place Details
      // request — required for the keystroke billing to zero out.
      const details = await api.placesDetails(suggestion.placeId, sessionToken);
      finishSelection({ lat: details.lat, lng: details.lng, address: details.address });
    } catch {
      showError(t("locationSearch.couldntResolve"));
    } finally {
      setResolving(false);
    }
  }

  // Recent/popular entries already have lat/lng resolved (from a past
  // Place Details call or from an actual published ride) — no need to
  // spend another Autocomplete/Details round trip re-resolving them.
  function handlePickKnown(loc: { lat: number; lng: number; address: string }) {
    finishSelection(loc);
  }

  // Mic icon lives inside the search field itself (same spot Google
  // Maps puts it), not a separate button elsewhere — tap to start,
  // speak an address, and the transcript drives the exact same
  // autocomplete path a typed query would (handleChangeText), so
  // there's nothing different downstream to keep in sync.
  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) handleChangeText(transcript);
  });
  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    // "no-speech"/"aborted" are just "nothing was said" or "tapped stop"
    // — not worth an error toast, same as RazorpayCheckout's own
    // cancel-isn't-a-failure distinction elsewhere in this app.
    if (event.error === "no-speech" || event.error === "aborted") return;
    if (event.error === "not-allowed") {
      showError(t("locationSearch.micPermissionDenied"));
      return;
    }
    showError(t("locationSearch.voiceSearchFailed"));
  });

  async function handleVoiceSearch() {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      showError(t("locationSearch.micPermissionDenied"));
      return;
    }
    setQuery("");
    setSuggestions([]);
    ExpoSpeechRecognitionModule.start({ lang: "en-IN", interimResults: true, continuous: false });
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
      showError(err?.message || t("locationSearch.couldntGetLocation"));
    } finally {
      setLocating(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoider>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.inputWrap}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.input}
            placeholder={listening ? t("locationSearch.listening") : t("locationSearch.searchPlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={handleChangeText}
            autoFocus
          />
          <Pressable onPress={handleVoiceSearch} hitSlop={8}>
            <Ionicons
              name={listening ? "mic" : "mic-outline"}
              size={18}
              color={listening ? colors.danger : colors.textMuted}
            />
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.currentLocationRow} onPress={handleUseCurrentLocation} disabled={locating}>
        <View style={styles.currentLocationIcon}>
          {locating ? (
            <ActivityIndicator size="small" color={colors.accentText} />
          ) : (
            <Ionicons name="locate" size={16} color={colors.accentText} />
          )}
        </View>
        <Text style={styles.currentLocationText}>{locating ? t("locationSearch.findingYou") : t("locationSearch.useCurrentLocation")}</Text>
      </Pressable>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        data={suggestions}
        keyExtractor={(item) => item.placeId}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => handleSelect(item)}>
            <Ionicons name="location-outline" size={16} color={colors.textMuted} />
            <Text style={styles.rowText}>{item.description}</Text>
          </Pressable>
        )}
        // Recent/popular only make sense before the person has typed
        // anything worth showing actual matches for — once there's a
        // real query, real suggestions replace them rather than sitting
        // above a second, unrelated list.
        ListHeaderComponent={
          query.length < 3 ? (
            <>
              {recent.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t("locationSearch.recent")}</Text>
                  {recent.map((loc) => (
                    <Pressable key={loc.address} style={styles.row} onPress={() => handlePickKnown(loc)}>
                      <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                      <Text style={styles.rowText} numberOfLines={1}>{loc.address}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {popular.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t("locationSearch.topSearches")}</Text>
                  {popular.map((loc) => (
                    <Pressable key={loc.address} style={styles.row} onPress={() => handlePickKnown(loc)}>
                      <Ionicons name="trending-up-outline" size={16} color={colors.textMuted} />
                      <Text style={styles.rowText} numberOfLines={1}>{loc.address}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          ) : null
        }
        ListEmptyComponent={
          query.length >= 3 ? (
            <EmptyState icon="search-outline" title={t("locationSearch.noMatches")} subtitle={t("locationSearch.noMatchesSubtitle")} />
          ) : null
        }
      />
      </KeyboardAvoider>
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
  backButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  inputWrap: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.bg, borderRadius: radius.sm, paddingHorizontal: spacing.sm, height: 40,
  },
  input: { flex: 1, ...typography.body, height: 40, color: colors.textPrimary },
  currentLocationRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  currentLocationIcon: { width: 24, alignItems: "center" },
  currentLocationText: { ...typography.body, color: colors.accentText, fontWeight: "700", fontFamily: FONT.bold },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { ...typography.body, flex: 1 },
  section: { paddingTop: spacing.sm },
  sectionTitle: { ...typography.caption, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
});
