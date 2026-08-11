import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../api";
// Bundled copies of the backend's own locale files (backend/src/locales/
// {en,hi}.json — kept in sync by literally copying the file, same
// convention as admin/prisma/schema.prisma being a synced copy of
// backend's). This is what renders on first paint (before the network
// fetch below resolves) and what's used if that fetch ever fails
// (offline, backend down) — the app should never show a raw
// "auth.enterPhone" key instead of real text just because of a bad
// connection.
import en from "./en.json";
import hi from "./hi.json";
import ta from "./ta.json";
import kn from "./kn.json";
import mr from "./mr.json";
import bn from "./bn.json";

type Bundle = Record<string, string>;
const BUNDLED: Record<string, Bundle> = { en, hi, ta, kn, mr, bn };
const FALLBACK_LOCALE = "en";
const LOCALE_STORAGE_KEY = "locale";

type I18nContextValue = {
  locale: string;
  // Actually switches the app's language everywhere `t()` is used, not
  // just a stored preference nobody reads — LanguageSelectionScreen used
  // to only write AsyncStorage directly, which meant picking Hindi
  // changed nothing until (never, since nothing ever read it back).
  setLocale: (locale: string) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue>({
  locale: FALLBACK_LOCALE,
  setLocale: async () => {},
  t: (key) => key,
});

function interpolate(str: string, params?: Record<string, string | number>) {
  if (!params) return str;
  let result = str;
  for (const [k, v] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return result;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState(FALLBACK_LOCALE);
  const [bundle, setBundle] = useState<Bundle>(BUNDLED[FALLBACK_LOCALE]);

  const applyLocale = useCallback(async (loc: string) => {
    // Bundled copy first — instant, works offline, and is always at
    // least as complete as whatever shipped with this build.
    setLocaleState(loc);
    setBundle(BUNDLED[loc] || BUNDLED[FALLBACK_LOCALE]);
    // Then a live fetch on top — picks up any translation added/fixed
    // server-side after this build shipped, without an app update.
    // Merged over the bundled copy (not replacing it) so a key the
    // server bundle hasn't caught up on yet still falls back to the
    // shipped translation instead of disappearing.
    try {
      const res = await fetch(`${API_BASE_URL}/api/i18n/${loc}`);
      // A 404 means this server doesn't have a file for `loc` yet (e.g.
      // it hasn't been redeployed since a new language was added) — the
      // backend used to silently 200 with English content instead, which
      // this code would then merge *over* the correctly bundled
      // translation, corrupting it with English text key-by-key. Treat a
      // non-OK response the same as a network failure: keep the bundled
      // copy already set above, untouched.
      if (!res.ok) return;
      const remote = await res.json();
      setBundle((prev) => ({ ...(BUNDLED[loc] || BUNDLED[FALLBACK_LOCALE]), ...remote }));
    } catch {
      // Offline or the request failed — the bundled copy set above already stands.
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(LOCALE_STORAGE_KEY).then((stored) => {
      applyLocale(stored || FALLBACK_LOCALE);
    });
  }, [applyLocale]);

  const setLocale = useCallback(
    async (loc: string) => {
      await AsyncStorage.setItem(LOCALE_STORAGE_KEY, loc);
      await applyLocale(loc);
    },
    [applyLocale]
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const str = bundle[key] ?? BUNDLED[FALLBACK_LOCALE][key] ?? key;
      return interpolate(str, params);
    },
    [bundle]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// `t` reads fresh on every render via context (not a one-time snapshot),
// so every screen using it re-renders in the new language the instant
// setLocale resolves — no app restart needed.
export function useTranslation() {
  return useContext(I18nContext);
}
