import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// A tiny wrapper, not raw Haptics.* calls scattered per call site — so
// every button/toast/alert in the app gets consistent feedback from one
// place, and the platform decision below only has to be made once.
//
// iOS-only: iOS's Taptic Engine is reliable and expected by users of
// this platform; Android haptic quality/presence varies a lot across
// this app's device range (see theme.ts's own comments on Android
// fragmentation, re: Force Dark) and can read as random buzzing rather
// than feedback tied to what was just tapped. Cheap to widen to all
// platforms later since every call site already goes through here.
const isIOS = Platform.OS === "ios";

export const haptics = {
  // Light tap feedback — every Button press, regardless of variant.
  tap: () => {
    if (isIOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  // A completed action (payment succeeded, booking confirmed) — paired
  // with Toast's success variant.
  success: () => {
    if (isIOS) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  // A failed action — paired with Toast's error variant.
  error: () => {
    if (isIOS) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
  // Something the user should pay attention to before proceeding — a
  // destructive confirmation dialog appearing (AlertModalHost), not the
  // button tap that dismisses it.
  warning: () => {
    if (isIOS) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
};
