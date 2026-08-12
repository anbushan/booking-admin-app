import AsyncStorage from "@react-native-async-storage/async-storage";

// Separate flags per role, not one shared "seenCopilotTour" — the driver
// and passenger Home layouts are two entirely different screens (see
// HomeScreen.tsx's `isDriver` branch), so a driver who's already toured
// their own Home shouldn't have the tour silently skipped the one time
// they (or a shared/demo device) switches to a passenger account, and
// vice versa. Same storage-key convention as locationPriming.ts.
function storageKey(role: "DRIVER" | "PASSENGER") {
  return `seenCopilotTour:${role}`;
}

export async function hasSeenCopilotTour(role: "DRIVER" | "PASSENGER"): Promise<boolean> {
  return (await AsyncStorage.getItem(storageKey(role))) === "true";
}

export async function markCopilotTourSeen(role: "DRIVER" | "PASSENGER") {
  await AsyncStorage.setItem(storageKey(role), "true");
}
