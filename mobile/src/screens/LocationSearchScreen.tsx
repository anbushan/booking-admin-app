import React, { useState } from "react";
import { View, TextInput, FlatList, Text, StyleSheet, ActivityIndicator, Platform, Linking } from "react-native";
import { Pressable } from "../components/Pressable";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography, FONT } from "../theme/theme";
import { api } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { useToast } from "../components/Toast";
import { EmptyState } from "../components/EmptyState";
import { KeyboardAvoider } from "../components/KeyboardAvoider";
import { PermissionModal } from "../components/PermissionModal";
import { useScreenView } from "../lib/useScreenView";
import { getRecentSearches, addRecentSearch, RecentLocation } from "../lib/recentSearches";
import { useTranslation } from "../lib/i18n/I18nContext";
import { appEvents } from "../lib/appEvents";

type Suggestion = { placeId: string; description: string };
type PopularLocation = { address: string; lat: number; lng: number; count: number };

// expo-speech-recognition's native module has no optional fallback —
// its own index.js calls requireNativeModule("ExpoSpeechRecognition")
// at import time with nothing to catch a missing binary, so a plain
// `import ... from "expo-speech-recognition"` throws immediately (before
// this screen even mounts) on any JS bundle running against a native
// build that doesn't have it compiled in — Expo Go, or any device/
// simulator still on an older build from before this dependency was
// added. Since this screen used to be statically imported from App.tsx,
// that crash used to take down the whole app at launch, not just this
// screen. Loaded via require() inside try/catch instead, so an old
// binary just loses the mic button rather than the entire app.
let SpeechRecognitionModule: typeof import("expo-speech-recognition") | null = null;
try {
  SpeechRecognitionModule = require("expo-speech-recognition");
} catch {
  SpeechRecognitionModule = null;
}
const VOICE_SEARCH_AVAILABLE = !!SpeechRecognitionModule;
// Availability is fixed for the whole app session (it can never flip
// between renders), so swapping in a same-shaped no-op when the real
// module isn't there still satisfies the Rules of Hooks — this screen
// always calls exactly one of the two, consistently, every render.
const useSpeechRecognitionEvent: typeof import("expo-speech-recognition").useSpeechRecognitionEvent =
  SpeechRecognitionModule?.useSpeechRecognitionEvent ?? (() => {});

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
  // selectFor (a plain string, e.g. "home-source") replaces what used to
  // be an `onSelect` callback passed straight through navigation params —
  // React Navigation warns the moment a function ends up in route params
  // ("non-serializable values were found in the navigation state"), since
  // that state is meant to be persistable/restorable. The caller
  // (HomeScreen/OfferRideScreen) listens for appEvents' "location:selected"
  // instead — see finishSelection below.
  const { selectFor, skipMapConfirm } = route.params || {};
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [sessionToken] = useState(newSessionToken);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [recent, setRecent] = useState<RecentLocation[]>([]);
  const [popular, setPopular] = useState<PopularLocation[]>([]);
  const [listening, setListening] = useState(false);
  const [micModalVisible, setMicModalVisible] = useState(false);
  const [micModalBlocked, setMicModalBlocked] = useState(false);
  const [requestingMicPermission, setRequestingMicPermission] = useState(false);
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

  // Shared by every path that resolves a final point (a tapped
  // suggestion, a tapped recent/popular entry, "use current location")
  // — reports the pick back the same way regardless of source. Kept
  // separate from finishSelection below so "use current location" can
  // reuse this without also (redundantly) adding itself to recent
  // searches, matching its original behavior.
  function emitSelection(loc: { lat: number; lng: number; address: string }) {
    if (skipMapConfirm) {
      appEvents.emit("location:selected", { selectFor, location: loc });
      navigation.goBack();
      return;
    }
    navigation.navigate("MapPinConfirm", { ...loc, selectFor });
  }

  function finishSelection(loc: { lat: number; lng: number; address: string }) {
    addRecentSearch(loc);
    emitSelection(loc);
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

  function startListening() {
    if (!SpeechRecognitionModule) return;
    setQuery("");
    setSuggestions([]);
    SpeechRecognitionModule.ExpoSpeechRecognitionModule.start({ lang: "en-IN", interimResults: true, continuous: false });
  }

  // Tapping the mic never pops the raw OS permission dialog cold — the
  // first time, it shows PermissionModal to explain why first (same
  // "ask before asking" pattern LocationPermissionPrimingScreen uses
  // for location), and only requests for real once the user taps Allow
  // there. Once granted, every later tap here skips straight to
  // startListening() — getPermissionsAsync() doesn't itself prompt, so
  // checking it first means an already-granted user is never nagged
  // again.
  async function handleVoiceSearch() {
    if (!SpeechRecognitionModule) return;
    const { ExpoSpeechRecognitionModule } = SpeechRecognitionModule;
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const existing = await ExpoSpeechRecognitionModule.getPermissionsAsync();
    if (existing.granted) {
      startListening();
      return;
    }
    setMicModalBlocked(!existing.canAskAgain);
    setMicModalVisible(true);
  }

  async function handleAllowMicPermission() {
    if (!SpeechRecognitionModule) return;
    const { ExpoSpeechRecognitionModule } = SpeechRecognitionModule;
    if (micModalBlocked) {
      // Already permanently denied (Android's "don't ask again", or iOS
      // after a first refusal) — requestPermissionsAsync() would just
      // silently re-deny instead of prompting, so Settings is the only
      // real next step.
      setMicModalVisible(false);
      Linking.openSettings();
      return;
    }
    setRequestingMicPermission(true);
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setMicModalVisible(false);
      if (result.granted) {
        // "Do it later" never applies here — the whole point of priming
        // first is that once they've actually said yes, the thing they
        // tapped the mic for happens immediately, not on a second tap.
        startListening();
      } else {
        showError(t("locationSearch.micPermissionDenied"));
      }
    } finally {
      setRequestingMicPermission(false);
    }
  }

  function handleNotNowMicPermission() {
    setMicModalVisible(false);
  }

  async function handleUseCurrentLocation() {
    if (locating) return;
    setLocating(true);
    try {
      const loc = await api.getCurrentLocation();
      emitSelection(loc);
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
          {VOICE_SEARCH_AVAILABLE && (
            <Pressable onPress={handleVoiceSearch} hitSlop={8}>
              <Ionicons
                name={listening ? "mic" : "mic-outline"}
                size={18}
                color={listening ? colors.danger : colors.textMuted}
              />
            </Pressable>
          )}
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

      {VOICE_SEARCH_AVAILABLE && (
        <PermissionModal
          visible={micModalVisible}
          icon="mic-outline"
          title={t("locationSearch.micPermissionTitle")}
          description={t("locationSearch.micPermissionDescription")}
          allowing={requestingMicPermission}
          blocked={micModalBlocked}
          onAllow={handleAllowMicPermission}
          onNotNow={handleNotNowMicPermission}
        />
      )}
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
