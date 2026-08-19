import Constants from "expo-constants";

// Compares two "x.y.z" version strings numerically, segment by segment —
// not a string compare (which would wrongly say "0.9.0" > "0.10.0"). A
// missing segment on either side counts as 0, so "1.2" vs "1.2.0" compare
// equal rather than erroring.
function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map((n) => parseInt(n, 10) || 0);
  const partsB = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// This device's installed app version — Constants.expoConfig.version
// mirrors app.json's top-level "version" field (the same one EAS bumps
// on each Play Store submission), not the Android versionCode.
export function getAppVersion(): string {
  return Constants.expoConfig?.version || "0.0.0";
}

// True when this install is older than minSupportedVersion (from GET
// /api/app-status — see SplashOnboardingScreens.tsx for where this gets
// checked, once, at launch, right after the maintenanceMode check).
export function isVersionBelowMinimum(minSupportedVersion: string): boolean {
  return compareVersions(getAppVersion(), minSupportedVersion) < 0;
}
