import { pushAlert, AlertButton } from "./alertStore";

// Every confirmation dialog and error alert in this app used to go
// through the OS's own Alert.alert (and, on web, a window.confirm/alert
// shim — react-native-web's Alert.alert() is a complete no-op). Now they
// all render through AlertModalHost instead, in the app's own visual
// language on every platform — same drop-in signature
// (showAlert(title, message, buttons)) so none of the ~40 call sites
// needed to change.
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  pushAlert({ title, message, buttons: buttons?.length ? buttons : [{ text: "OK" }] });
}
