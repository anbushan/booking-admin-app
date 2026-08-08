// Plain module-level pub/sub, same shape as networkStatus.ts's pattern —
// lib/alert.ts's showAlert() is an ordinary function called from
// anywhere (including outside any component), so it can't use a hook or
// context directly. AlertModalHost (mounted once at the App root)
// registers itself here; showAlert() pushes a request into the queue
// and the host renders whatever's current.
export type AlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

export type AlertRequest = {
  title: string;
  message?: string;
  buttons: AlertButton[];
};

type Listener = (queue: AlertRequest[]) => void;

let queue: AlertRequest[] = [];
let listener: Listener | null = null;

export function registerAlertListener(fn: Listener | null) {
  listener = fn;
}

export function pushAlert(request: AlertRequest) {
  queue = [...queue, request];
  listener?.(queue);
}

export function popAlert() {
  queue = queue.slice(1);
  listener?.(queue);
}
