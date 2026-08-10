import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pressable } from "../components/Pressable";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { api } from "../lib/api";
import { Analytics } from "../lib/analytics";
import { CarLoader } from "../components/CarLoader";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader } from "../components/BackHeader";
import { useScreenView } from "../lib/useScreenView";

type Profile = { role: string; isDriver: boolean; isPassenger: boolean };

// Two entry points:
// - Forced (route.params.forced): every returning login goes through
//   here now, not just when both a driver and a passenger profile
//   already exist — continuing as whichever role was already active is
//   a single tap (that card is pre-marked "Current"), and it's also
//   where switching, or setting up this number's *other* role for the
//   first time, gets offered right at login instead of only being
//   reachable later from the side menu. No back button here for the
//   same reason RegisterScreen has none: there's nothing to go back to
//   yet.
// - Manual (no `forced`): reached from the side menu at any time —
//   identical screen, just with a real back button since there's
//   somewhere to return to.
export default function SwitchRoleScreen({ navigation, route }: any) {
  useScreenView("SwitchRoleScreen");
  const { forced } = route.params || {};
  const [profile, setProfile] = useState<Profile | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    api.getMyProfile().then(setProfile).catch(() => {});
  }, []);

  async function selectRole(role: "PASSENGER" | "DRIVER") {
    if (!profile || switching) return;
    if (role === profile.role) {
      // Already active — nothing to do, just leave.
      if (forced) navigation.reset({ index: 0, routes: [{ name: "Home" }] });
      else navigation.goBack();
      return;
    }
    const isFirstTime = role === "DRIVER" ? !profile.isDriver : !profile.isPassenger;
    setSwitching(role);
    try {
      await api.switchRole(role);
      Analytics.roleSwitched(role);
      navigation.reset({
        index: 0,
        // A driver profile with no vehicle on file yet can't actually
        // offer rides — same landing spot a brand-new driver signup
        // gets sent to (see RegisterScreen), so switching into driving
        // for the first time isn't a dead end once they hit Home.
        routes: [{ name: isFirstTime && role === "DRIVER" ? "DriverOnboarding" : "Home" }],
      });
    } catch (err: any) {
      showAlert("Couldn't switch", err.message);
      setSwitching(null);
    }
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.screen, { alignItems: "center", justifyContent: "center" }]} edges={["top", "bottom"]}>
        <CarLoader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {!forced && <BackHeader title="Switch role" onBack={() => navigation.goBack()} />}

      <View style={styles.body}>
        <View style={styles.brandIcon}>
          <Ionicons name="swap-horizontal" size={26} color={colors.accentText} />
        </View>
        <Text style={styles.title}>{forced ? "Continue as..." : "Use this number as"}</Text>
        <Text style={styles.subtitle}>
          {forced
            ? "Tap your current role to jump straight in, or use this number as the other one instead — you can always switch again from the menu."
            : "Switch to your other profile, or set one up for the first time. Nothing about your existing bookings or rides changes."}
        </Text>

        <View style={styles.roleRow}>
          {(["PASSENGER", "DRIVER"] as const).map((role) => {
            const active = profile.role === role;
            const hasProfile = role === "DRIVER" ? profile.isDriver : profile.isPassenger;
            const busy = switching === role;
            return (
              <Pressable
                key={role}
                style={[styles.roleCard, active && styles.roleCardActive]}
                onPress={() => selectRole(role)}
                disabled={!!switching}
              >
                {active && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Current</Text>
                  </View>
                )}
                <View style={[styles.roleIconWrap, active && styles.roleIconWrapActive]}>
                  <Ionicons
                    name={role === "PASSENGER" ? "person" : "car-sport"}
                    size={24}
                    color={active ? "#FFFFFF" : colors.accentText}
                  />
                </View>
                <Text style={[styles.roleText, active && styles.roleTextActive]}>
                  {role === "PASSENGER" ? "Passenger" : "Driver"}
                </Text>
                <Text style={styles.roleSub}>
                  {busy ? "Switching..." : hasProfile ? (active ? "Currently active" : "Tap to switch") : "New — tap to set up"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, flex: 1, justifyContent: "center" },
  brandIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentBg,
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: spacing.md,
  },
  title: { ...typography.title, fontSize: 18, textAlign: "center" },
  subtitle: { ...typography.small, color: colors.textMuted, textAlign: "center", marginTop: 4, marginBottom: spacing.lg, lineHeight: 18 },
  roleRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  roleCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  roleCardActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  currentBadge: {
    position: "absolute", top: spacing.sm, right: spacing.sm,
    backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7,
  },
  currentBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  roleIconWrap: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bg,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  roleIconWrapActive: { backgroundColor: colors.accent },
  roleText: { ...typography.title, fontSize: 14 },
  roleTextActive: { color: colors.accentText },
  roleSub: { ...typography.small, color: colors.textMuted, marginTop: 2, textAlign: "center" },
});
