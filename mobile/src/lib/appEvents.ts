// A minimal pub/sub — React Native has no built-in EventEmitter, and
// this app doesn't need a real one, just a way for a background piece
// (AppSocketBridge, reacting to a live socket event) to tell an
// on-screen component (AppBottomNav's badge counts) "something changed,
// go refetch" without threading a prop/context through every hub screen.
type Listener = (...args: any[]) => void;
const listeners: Record<string, Listener[]> = {};

export const appEvents = {
  on(event: string, fn: Listener) {
    (listeners[event] ||= []).push(fn);
    return () => {
      listeners[event] = (listeners[event] || []).filter((l) => l !== fn);
    };
  },
  emit(event: string, ...args: any[]) {
    (listeners[event] || []).forEach((fn) => fn(...args));
  },
};
