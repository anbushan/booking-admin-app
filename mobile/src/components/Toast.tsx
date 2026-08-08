import React, { createContext, useContext, useRef, useState } from "react";
import { Animated, Text, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";

type ToastType = "success" | "error";
type ToastState = { message: string; type: ToastType } | null;

const ToastContext = createContext<{
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ToastProvider wraps the whole app, above any one screen's own
  // layout, so it has no idea whether the current screen has
  // AppBottomNav docked at the bottom — clearing it with a fixed
  // safe-area-aware offset here is simpler than threading that down.
  const insets = useSafeAreaInsets();

  function show(message: string, type: ToastType) {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setToast({ message, type });
    translateY.setValue(24);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 12, duration: 200, useNativeDriver: true }),
      ]).start(() => setToast(null));
    }, 2500);
  }

  return (
    <ToastContext.Provider
      value={{
        showSuccess: (message) => show(message, "success"),
        showError: (message) => show(message, "error"),
      }}
    >
      {children}
      {toast && (
        // A solid dark bar rather than a tinted/outlined box — the type
        // reads from the icon's color, not the whole snackbar changing
        // background, closer to how BlaBlaCar's own confirmation
        // snackbars read (one consistent bar, an accent color doing the
        // signaling) than a loud red/green box every time.
        <Animated.View
          pointerEvents="none"
          style={[styles.toast, { bottom: insets.bottom + 76, opacity, transform: [{ translateY }] }]}
        >
          <View style={[styles.iconWrap, toast.type === "success" ? styles.iconWrapSuccess : styles.iconWrapError]}>
            <Ionicons
              name={toast.type === "success" ? "checkmark" : "close"}
              size={13}
              color="#FFFFFF"
            />
          </View>
          <Text style={styles.text} numberOfLines={2}>{toast.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    // Was colors.textPrimary (near-black) — invisible against Home's
    // own near-black header background. The accent blue reads clearly
    // against every surface in the app, light or dark, so the toast
    // itself no longer depends on knowing what's behind it.
    backgroundColor: colors.accent,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  iconWrap: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", flex: 0 },
  iconWrapSuccess: { backgroundColor: colors.success },
  iconWrapError: { backgroundColor: colors.danger },
  text: { ...typography.caption, color: "#FFFFFF", fontWeight: "500", flex: 1 },
});
