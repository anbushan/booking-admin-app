import AsyncStorage from "@react-native-async-storage/async-storage";

// LocationSearchScreen's "Recent" list — purely on-device (no backend
// call, no per-user account needed), same AsyncStorage the auth token
// already uses. Deliberately not tied to login: switching between
// driver/passenger role on the same phone should still see the same
// recently-picked places, since it's about the device's history of
// places, not which role is currently active.
const STORAGE_KEY = "recentLocationSearches";
const MAX_ENTRIES = 6;

export type RecentLocation = { address: string; lat: number; lng: number };

export async function getRecentSearches(): Promise<RecentLocation[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Most-recent-first, de-duplicated by address (re-picking a place moves
// it back to the top rather than creating a second entry), capped at
// MAX_ENTRIES so this never grows unbounded.
export async function addRecentSearch(entry: RecentLocation) {
  try {
    const existing = await getRecentSearches();
    const deduped = existing.filter((e) => e.address !== entry.address);
    const updated = [entry, ...deduped].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Best-effort — losing recent-search history isn't worth surfacing an error over.
  }
}
