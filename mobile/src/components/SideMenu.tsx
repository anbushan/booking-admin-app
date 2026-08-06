import React from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { showAlert } from "../lib/alert";
import { colors, spacing, radius, typography } from "../theme/theme";
import { logout } from "../lib/api";
import { Analytics } from "../lib/analytics";

// Home never had any way into the rest of the app — Profile, History,
// Chat, Notifications, and the driver tools were all built and
// registered in the navigator but reachable from nowhere. This is the
// single entry point for all of it, opened from a hamburger icon on
// Home's header.

type Props = {
  visible: boolean;
  onClose: () => void;
  navigation: any;
  profile: { id?: string; name?: string; role?: string } | null;
};

export default function SideMenu({ visible, onClose, navigation, profile }: Props) {
  function go(route: string, params?: Record<string, any>) {
    onClose();
    navigation.navigate(route, params);
  }

  function handleLogout() {
    showAlert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout();
          Analytics.logout();
          onClose();
          navigation.reset({ index: 0, routes: [{ name: "PhoneEntry" }] });
        },
      },
    ]);
  }

  const isDriver = profile?.role === "DRIVER";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
          <View style={styles.profileBlock}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(profile?.name || "?").charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.name}>{profile?.name || "Your profile"}</Text>
            <Text style={styles.role}>{isDriver ? "Driver" : "Passenger"}</Text>
          </View>

          <MenuRow label="Home" onPress={() => go("Home")} />
          <MenuRow label="My bookings" onPress={() => go("History", { role: profile?.role })} />
          <MenuRow
            label="Chat"
            onPress={() => go("ChatList", { currentUserId: profile?.id, role: profile?.role })}
          />
          <MenuRow label="Notifications" onPress={() => go("Notifications")} />

          {isDriver && (
            <>
              <Text style={styles.sectionLabel}>Driver</Text>
              <MenuRow label="Offer a ride" onPress={() => go("OfferRide")} />
              <MenuRow label="Booking requests" onPress={() => go("BookingRequests")} />
              <MenuRow label="Upcoming trips" onPress={() => go("UpcomingTrips")} />
              <MenuRow label="My vehicles" onPress={() => go("VehicleList")} />
              <MenuRow label="Earnings" onPress={() => go("Earnings")} />
            </>
          )}

          <Text style={styles.sectionLabel}>Account</Text>
          <MenuRow label="Settings" onPress={() => go("Settings")} />

          <Pressable style={styles.logoutRow} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, flexDirection: "row", backgroundColor: "rgba(0,0,0,0.4)" },
  panel: {
    width: "78%",
    maxWidth: 320,
    height: "100%",
    backgroundColor: colors.surface,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  profileBlock: { marginBottom: spacing.lg, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarText: { ...typography.title, color: colors.accentText },
  name: { ...typography.title },
  role: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  sectionLabel: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  row: { paddingVertical: spacing.sm },
  rowText: { ...typography.body, color: colors.textPrimary },
  logoutRow: { marginTop: spacing.xl, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  logoutText: { ...typography.body, color: colors.danger },
});
