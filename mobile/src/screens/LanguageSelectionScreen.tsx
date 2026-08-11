import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { colors, spacing, radius, typography } from "../theme/theme";
import { Analytics } from "../lib/analytics";
import { API_BASE_URL } from "../lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";
import { useTranslation } from "../lib/i18n/I18nContext";

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  hi: "हिन्दी (Hindi)",
  ta: "தமிழ் (Tamil)",
  kn: "ಕನ್ನಡ (Kannada)",
  mr: "मराठी (Marathi)",
  bn: "বাংলা (Bengali)",
};

// Fixed display order — the server's own list (GET /api/i18n/locales)
// comes from a plain readdirSync, which isn't guaranteed to match this,
// so the list used to visibly reorder itself the moment that fetch
// resolved after first paint. Sorting every list through this before it
// ever reaches state keeps the row order identical before and after the
// fetch, so there's nothing left to flicker. Anything the server
// returns that isn't in this list yet (a newly added language) still
// shows up, just appended alphabetically at the end.
const LOCALE_ORDER = ["en", "hi", "ta", "kn", "mr", "bn"];
function sortLocales(list: string[]) {
  return [...list].sort((a, b) => {
    const ai = LOCALE_ORDER.indexOf(a);
    const bi = LOCALE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export default function LanguageSelectionScreen({ navigation }: any) {
  useScreenView("LanguageSelectionScreen");
  const { t, locale, setLocale } = useTranslation();
  const [locales, setLocales] = useState<string[]>(LOCALE_ORDER);
  // Picking a row no longer applies it immediately — it just marks a
  // pending choice, so a stray tap doesn't switch the whole app out from
  // under you before you meant to confirm. Starts at the currently
  // active locale so "Confirm" is a no-op until something's actually
  // changed.
  const [pending, setPending] = useState(locale);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/i18n/locales`)
      .then((r) => r.json())
      // Union with LOCALE_ORDER, never replace — the app already ships a
      // complete bundled translation for every locale in LOCALE_ORDER
      // (see I18nContext's BUNDLED map), so those are always safe to
      // offer regardless of what this fetch reports. Without this, a
      // backend that's simply behind on deploying newer locale files
      // (or briefly unreachable) would narrow the picker down to
      // whatever subset it happens to have on disk right now, hiding
      // languages the app can actually render perfectly well offline.
      .then((list: string[]) => {
        if (Array.isArray(list) && list.length) {
          setLocales(sortLocales(Array.from(new Set([...LOCALE_ORDER, ...list]))));
        }
      })
      .catch(() => {});
  }, []);

  // Actually switches the app's language now (see I18nContext) — this
  // used to only write AsyncStorage directly, so every screen kept
  // showing English regardless of what was picked here.
  async function handleConfirm() {
    if (pending === locale) {
      navigation.goBack();
      return;
    }
    setConfirming(true);
    await setLocale(pending);
    Analytics.languageChanged(pending);
    setConfirming(false);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <BackHeader title={t("settings.language")} onBack={() => navigation.goBack()} />

      <FlatList
        style={{ flex: 1 }}
        data={locales}
        keyExtractor={(item) => item}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => (
          <Pressable style={[styles.row, pending === item && styles.rowActive]} onPress={() => setPending(item)}>
            <Text style={styles.rowText}>{LOCALE_LABELS[item] || item}</Text>
            {pending === item && <Text style={styles.checkmark}>{"✓"}</Text>}
          </Pressable>
        )}
      />

      <View style={styles.footer}>
        <Pressable style={styles.confirmButton} onPress={handleConfirm} disabled={confirming}>
          <Text style={styles.confirmButtonText}>{confirming ? t("switchRole.switching") : t("common.confirm")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  rowActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  rowText: typography.body,
  checkmark: { color: colors.accentText, fontWeight: "700" },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  confirmButton: { backgroundColor: colors.textPrimary, height: 46, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  confirmButtonText: { ...typography.title, color: "#FFFFFF" },
});
