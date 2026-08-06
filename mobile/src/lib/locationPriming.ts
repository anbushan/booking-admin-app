import AsyncStorage from "@react-native-async-storage/async-storage";

// Returns true if the priming screen has already been shown once — the
// plan calls for this to appear contextually before the first trip, not
// repeatedly nagging on every trip after that.
export async function hasSeenLocationPriming(): Promise<boolean> {
  return (await AsyncStorage.getItem("seenLocationPriming")) === "true";
}

export async function markLocationPrimingSeen() {
  await AsyncStorage.setItem("seenLocationPriming", "true");
}

// Call this from any screen that's about to navigate into a
// location-dependent flow (Start Trip, Trip OTP → Live Tracking). If the
// priming screen hasn't been shown yet, it takes over navigation first
// and the original destination resumes via onContinue once done.
export async function primeLocationIfNeeded(
  navigation: any,
  destinationRoute: string,
  destinationParams: Record<string, any>
) {
  const seen = await hasSeenLocationPriming();
  if (seen) {
    navigation.navigate(destinationRoute, destinationParams);
    return;
  }

  navigation.navigate("LocationPermissionPriming", {
    onContinue: async () => {
      await markLocationPrimingSeen();
      navigation.navigate(destinationRoute, destinationParams);
    },
  });
}
