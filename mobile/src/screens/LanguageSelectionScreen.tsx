import React, { useEffect, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, spacing, radius, typography } from "../theme/theme";
import { Analytics } from "../lib/analytics";
import { SafeAreaView } from "react-native-safe-area-context";

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  hi: "\u0939\u093F\u0928\u094D\u0926\u0940 (Hindi)",
};

const API_BASE_URL = "http://192.168.1.3:4000";

export default function LanguageSelectionScreen({ navigation }: any) {
  const [locales, setLocales] = useState<string[]>([]);
  const [selected, setSelected] = useState("en");

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/i18n/locales`)
      .then((r) => r.json())
      .then(setLocales)
      .catch(() => setLocales(["en"]));
    AsyncStorage.getItem("locale").then((l) => l && setSelected(l));
  }, []);

  async function handleSelect(locale: string) {
    setSelected(locale);
    await AsyncStorage.setItem("locale", locale);
    Analytics.languageChanged(locale);
    // The actual string bundle is fetched via GET /api/i18n/:locale and
    // cached client-side (e.g. in a small i18n context provider) — left
    // as a follow-up wiring step once more screens read from it instead
    // of hardcoded English strings.
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{"<"}</Text>
        </Pressable>
        <Text style={styles.title}>Language</Text>
      </View>

      <FlatList
        data={locales}
        keyExtractor={(item) => item}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => handleSelect(item)}>
            <Text style={styles.rowText}>{LOCALE_LABELS[item] || item}</Text>
            {selected === item && <Text style={styles.checkmark}>{"\u2713"}</Text>}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  back: { fontSize: 18 },
  title: typography.title,
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  rowText: typography.body,
  checkmark: { color: colors.accentText, fontWeight: "500" },
});
