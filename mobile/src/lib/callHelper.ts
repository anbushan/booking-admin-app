import { Linking } from "react-native";

// Backend currently returns the callee's bare 10-digit number (no real
// masking provider configured — see calls.routes.js's own comment on
// why), not one already carrying a country code the way a real proxy
// number would once that's wired up.
export async function dialProxyNumber(proxyNumber: string) {
  const dialNumber = proxyNumber.startsWith("+") ? proxyNumber : `+91${proxyNumber}`;
  await Linking.openURL(`tel:${dialNumber}`);
}
