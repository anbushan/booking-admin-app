import React, { createContext, useContext, useRef, useState } from "react";
import { Animated, Text, StyleSheet, View } from "react-native";
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
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show(message: string, type: ToastType) {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setToast({ message, type });
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    hideTimer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
        setToast(null)
      );
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
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            toast.type === "success" ? styles.success : styles.error,
            { opacity },
          ]}
        >
          <Text style={[styles.text, toast.type === "success" ? styles.successText : styles.errorText]}>
            {toast.message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 40,
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  success: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.success },
  error: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.danger },
  text: { ...typography.caption, fontWeight: "500" },
  successText: { color: colors.success },
  errorText: { color: colors.danger },
});
