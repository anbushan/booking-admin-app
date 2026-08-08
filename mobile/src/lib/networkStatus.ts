import { showAlert } from "./alert";

// api.ts's request() calls this whenever fetch() itself fails — no
// connectivity, DNS failure, server unreachable — which is distinct
// from a normal HTTP error response (4xx/5xx already get handled by
// each screen's own .catch()). Previously this just surfaced as
// whatever raw message fetch() throws ("Network request failed") inside
// whatever generic error state a given screen happened to have, which
// is inconsistent and easy to miss. This shows one clear, consistent
// modal instead — reuses showAlert (already the cross-platform
// Alert.alert/window.confirm shim used everywhere else in the app).
//
// Debounced: a screen that fires several requests at once when offline
// (e.g. a list screen loading, plus a background poll) would otherwise
// stack up several identical alerts.
let lastShownAt = 0;
const DEBOUNCE_MS = 4000;

export function reportNetworkError() {
  const now = Date.now();
  if (now - lastShownAt < DEBOUNCE_MS) return;
  lastShownAt = now;
  showAlert(
    "No internet connection",
    "Check your connection and try again.",
    [{ text: "OK" }]
  );
}
