import { Alert, Platform } from "react-native";

type AlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

// react-native-web's Alert.alert() is a complete no-op (verified in
// node_modules/react-native-web: `static alert() {}`) — every confirmation
// dialog and every error alert in this app would silently do nothing on
// web, including destructive-action confirmations like logout, cancel
// booking, and remove vehicle. This shims it with window.confirm()/
// window.alert() on web and defers to the real native Alert everywhere
// else. Drop-in replacement for Alert.alert(title, message, buttons).
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons as any);
    return;
  }

  const text = [title, message].filter(Boolean).join("\n\n");

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancelButton = buttons.find((b) => b.style === "cancel");
  const confirmButton = buttons.find((b) => b !== cancelButton) || buttons[buttons.length - 1];

  if (window.confirm(text)) confirmButton?.onPress?.();
  else cancelButton?.onPress?.();
}
