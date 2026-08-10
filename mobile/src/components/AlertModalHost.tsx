import React, { useEffect, useState } from "react";
import { Modal, View, Text, StyleSheet } from "react-native";
import { Pressable } from "./Pressable";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, typography } from "../theme/theme";
import { registerAlertListener, popAlert, AlertRequest } from "../lib/alertStore";

// Mounted once at the App root (see App.tsx). Every showAlert(...) call
// across the app (42 call sites, from "cancel this booking?" to network
// errors) renders through here now, in the app's own visual language,
// instead of the OS's plain system dialog — the same information, but
// consistent with everything else on screen instead of a jarring
// context switch out to native chrome.
export default function AlertModalHost() {
  const [queue, setQueue] = useState<AlertRequest[]>([]);

  useEffect(() => {
    registerAlertListener(setQueue);
    return () => registerAlertListener(null);
  }, []);

  const current = queue[0];

  function handlePress(button: AlertRequest["buttons"][number]) {
    popAlert();
    button.onPress?.();
  }

  if (!current) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={current.buttons.some((b) => b.style === "destructive") ? "alert-circle-outline" : "information-circle-outline"}
              size={22}
              color={current.buttons.some((b) => b.style === "destructive") ? colors.danger : colors.accentText}
            />
          </View>
          <Text style={styles.title}>{current.title}</Text>
          {!!current.message && <Text style={styles.message}>{current.message}</Text>}
          <View style={styles.buttonRow}>
            {current.buttons.map((button, i) => (
              <Pressable
                key={i}
                style={[
                  styles.button,
                  button.style === "cancel" && styles.buttonCancel,
                  button.style === "destructive" && styles.buttonDestructive,
                ]}
                onPress={() => handlePress(button)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === "cancel" && styles.buttonTextCancel,
                    button.style === "destructive" && styles.buttonTextDestructive,
                  ]}
                >
                  {button.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(22,33,58,0.45)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: { width: "100%", maxWidth: 340, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center" },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  title: { ...typography.title, fontSize: 16, textAlign: "center" },
  message: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs, lineHeight: 19 },
  buttonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, width: "100%" },
  button: { flex: 1, backgroundColor: colors.accent, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  buttonCancel: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  buttonDestructive: { backgroundColor: colors.danger },
  buttonText: { ...typography.caption, color: "#FFFFFF", fontWeight: "700" },
  buttonTextCancel: { color: colors.textSecondary },
  buttonTextDestructive: { color: "#FFFFFF" },
});
