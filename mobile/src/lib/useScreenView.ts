import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Analytics } from "./analytics";

// Fires a screen_view on every focus, not just first mount — returning
// to a screen (back button, tab switch) is its own "view" in GA4's own
// model, the same way a repeat page load counts as a new pageview on
// web. Drop this one line at the top of a screen instead of hand-
// rolling the same useFocusEffect+Analytics call everywhere.
export function useScreenView(screenName: string) {
  useFocusEffect(
    useCallback(() => {
      Analytics.screenView(screenName);
    }, [screenName])
  );
}
