import React, { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, TextInput, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../theme/theme";

// Dependency-free date + time + seat-count picker. Deliberately avoids
// @react-native-community/datetimepicker (a native module that isn't
// available in plain Expo Go, same constraint as react-native-maps and
// react-native-razorpay elsewhere in this app) so the search flow keeps
// working without a custom dev client.

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_AHEAD = 14;
const MIN_SEATS = 1;
const MAX_SEATS = 8;

function buildDateOptions() {
  const options = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    options.push(d);
  }
  return options;
}

function labelForDate(d: Date, index: number) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return `${DAY_LABELS[d.getDay()]} ${d.getDate()}`;
}

export function formatSearchDate(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  const dayLabel = diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : `${DAY_LABELS[target.getDay()]} ${target.getDate()}`;
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${dayLabel}, ${hour12}:${String(minutes).padStart(2, "0")}${ampm}`;
}

type Props = {
  visible: boolean;
  initialDate: Date;
  initialSeats: number;
  onClose: () => void;
  onConfirm: (date: Date, seats: number) => void;
};

export default function SearchOptionsModal({ visible, initialDate, initialSeats, onClose, onConfirm }: Props) {
  const dateOptions = useState(buildDateOptions)[0];
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [timeText, setTimeText] = useState(() => {
    const h = initialDate.getHours();
    const m = initialDate.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  });
  const [seats, setSeats] = useState(initialSeats);
  const [timeError, setTimeError] = useState("");

  function parseTimeText(text: string): { hours: number; minutes: number } | null {
    const match = text.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 1 || hours > 12 || minutes > 59) return null;
    const ampm = match[3].toUpperCase();
    if (ampm === "PM" && hours !== 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    return { hours, minutes };
  }

  function handleConfirm() {
    const parsed = parseTimeText(timeText);
    if (!parsed) {
      setTimeError("Enter a time like 6:30 PM.");
      return;
    }
    const result = new Date(selectedDate);
    result.setHours(parsed.hours, parsed.minutes, 0, 0);
    onConfirm(result, seats);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>When are you traveling?</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateRow}>
            {dateOptions.map((d, i) => {
              const active = d.toDateString() === selectedDate.toDateString();
              return (
                <Pressable
                  key={d.toISOString()}
                  style={[styles.dateChip, active && styles.dateChipActive]}
                  onPress={() => setSelectedDate(d)}
                >
                  <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>
                    {labelForDate(d, i)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Time</Text>
          <TextInput
            style={styles.timeInput}
            value={timeText}
            onChangeText={(t) => { setTimeText(t); setTimeError(""); }}
            placeholder="6:30 PM"
            placeholderTextColor={colors.textMuted}
          />
          {timeError ? <Text style={styles.errorText}>{timeError}</Text> : null}

          <Text style={styles.label}>Seats</Text>
          <View style={styles.seatRow}>
            <Pressable
              style={styles.seatButton}
              disabled={seats <= MIN_SEATS}
              onPress={() => setSeats((s) => Math.max(MIN_SEATS, s - 1))}
            >
              <Text style={styles.seatButtonText}>−</Text>
            </Pressable>
            <Text style={styles.seatCount}>{seats}</Text>
            <Pressable
              style={styles.seatButton}
              disabled={seats >= MAX_SEATS}
              onPress={() => setSeats((s) => Math.min(MAX_SEATS, s + 1))}
            >
              <Text style={styles.seatButtonText}>+</Text>
            </Pressable>
          </View>

          <View style={styles.actionsRow}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  sheetTitle: { ...typography.title, marginBottom: spacing.md },
  dateRow: { marginBottom: spacing.md },
  dateChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  dateChipActive: { backgroundColor: colors.accentBg, borderColor: colors.accent },
  dateChipText: { ...typography.small, color: colors.textSecondary },
  dateChipTextActive: { color: colors.accentText, fontWeight: "500" },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  timeInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: { ...typography.small, color: colors.danger, marginTop: -spacing.sm, marginBottom: spacing.sm },
  seatRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  seatButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  seatButtonText: { fontSize: 18, color: colors.textPrimary },
  seatCount: { ...typography.title, minWidth: 24, textAlign: "center" },
  actionsRow: { flexDirection: "row", gap: spacing.sm },
  cancelButton: {
    flex: 1,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: { ...typography.title, color: colors.textSecondary },
  confirmButton: {
    flex: 1,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.textPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonText: { ...typography.title, color: "#FFFFFF" },
});
