import React, { useEffect, useRef, useState } from "react";
import { View, Text, Modal, ScrollView, TextInput, Animated, Easing, StyleSheet } from "react-native";
import { Pressable } from "./Pressable";
import { colors, spacing, radius, typography } from "../theme/theme";
import { KeyboardAvoider } from "./KeyboardAvoider";
import { useTranslation } from "../lib/i18n/I18nContext";

// Off-screen starting offset for the slide-up — see HowItWorksSheet for
// the same pattern and the reasoning (RN's Modal `animationType="slide"`
// is a fixed, non-interruptible, un-eased animation — a hand-rolled one
// is what actually reads as smooth).
const OFFSCREEN_Y = 700;

// Dependency-free date + time + seat-count picker. Deliberately avoids
// @react-native-community/datetimepicker (a native module that isn't
// available in plain Expo Go, same constraint as react-native-maps and
// react-native-razorpay elsewhere in this app) so the search flow keeps
// working without a custom dev client.

// English fallbacks baked in directly (not routed through the i18n
// bundle) — both functions are called from several screens that don't
// all have a `t` handy at every call site, and a translator is optional
// here specifically so none of those existing call sites break. Screens
// that do pass one (this modal itself, plus any updated to use
// useTranslation) get the real translated day names; the rest still get
// correct English instead of a raw i18n key.
const DAY_KEYS = ["searchOptions.day0", "searchOptions.day1", "searchOptions.day2", "searchOptions.day3", "searchOptions.day4", "searchOptions.day5", "searchOptions.day6"];
const DAY_LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_AHEAD = 14;
const MIN_SEATS = 1;
const MAX_SEATS = 8;

function dayLabel(dayIndex: number, t?: (key: string) => string) {
  return t ? t(DAY_KEYS[dayIndex]) : DAY_LABELS_EN[dayIndex];
}
function todayLabel(t?: (key: string) => string) {
  return t ? t("searchOptions.today") : "Today";
}
function tomorrowLabel(t?: (key: string) => string) {
  return t ? t("searchOptions.tomorrow") : "Tomorrow";
}

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

function labelForDate(d: Date, index: number, t?: (key: string) => string) {
  if (index === 0) return todayLabel(t);
  if (index === 1) return tomorrowLabel(t);
  return `${dayLabel(d.getDay(), t)} ${d.getDate()}`;
}

export function formatSearchDate(date: Date, t?: (key: string) => string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  const dLabel = diffDays === 0 ? todayLabel(t) : diffDays === 1 ? tomorrowLabel(t) : `${dayLabel(target.getDay(), t)} ${target.getDate()}`;
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${dLabel}, ${hour12}:${String(minutes).padStart(2, "0")}${ampm}`;
}

function timeToText(date: Date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

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

function toHHmm({ hours, minutes }: { hours: number; minutes: number }) {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

type Props = {
  visible: boolean;
  initialDate: Date;
  initialSeats: number;
  onClose: () => void;
  // rangeMode=false (default, used when publishing a ride): a single
  // departure time, onConfirm(date-with-time-set, seats) — unchanged.
  // rangeMode=true (used when searching): a start/end departure window
  // instead of one exact time, onConfirm(dateAtMidnight, seats,
  // startTimeHHmm, endTimeHHmm).
  rangeMode?: boolean;
  onConfirm: (date: Date, seats: number, startTime?: string, endTime?: string) => void;
};

export default function SearchOptionsModal({ visible, initialDate, initialSeats, onClose, onConfirm, rangeMode = false }: Props) {
  const { t } = useTranslation();
  const dateOptions = useState(buildDateOptions)[0];
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [timeText, setTimeText] = useState(() => timeToText(initialDate));
  const [startTimeText, setStartTimeText] = useState(() => timeToText(initialDate));
  const [endTimeText, setEndTimeText] = useState("11:59 PM");
  const [seats, setSeats] = useState(initialSeats);
  const [timeError, setTimeError] = useState("");

  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(OFFSCREEN_Y)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(OFFSCREEN_Y);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: OFFSCREEN_Y, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible]);

  function handleConfirm() {
    if (rangeMode) {
      const start = parseTimeText(startTimeText);
      const end = parseTimeText(endTimeText);
      if (!start || !end) {
        setTimeError(t("searchOptions.timeRangeError"));
        return;
      }
      const dayOnly = new Date(selectedDate);
      dayOnly.setHours(0, 0, 0, 0);
      onConfirm(dayOnly, seats, toHHmm(start), toHHmm(end));
      return;
    }

    const parsed = parseTimeText(timeText);
    if (!parsed) {
      setTimeError(t("searchOptions.timeError"));
      return;
    }
    const result = new Date(selectedDate);
    result.setHours(parsed.hours, parsed.minutes, 0, 0);
    onConfirm(result, seats);
  }

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* Dim layer is its own sibling, not a parent wrapping the sheet —
          KeyboardAvoider's inner content box is a plain (non-Animated)
          View, so an Animated.Value opacity dropped into its style
          wouldn't actually animate. Splitting them keeps the fade
          working without touching KeyboardAvoider itself. */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents="none" />
      <KeyboardAvoider style={styles.avoiderBackdrop}>
        <Animated.View style={{ transform: [{ translateY }] }}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{t("searchOptions.whenTraveling")}</Text>

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
                    {labelForDate(d, i, t)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {rangeMode ? (
            <>
              <Text style={styles.label}>{t("searchOptions.departingBetween")}</Text>
              <View style={styles.timeRangeRow}>
                <TextInput
                  style={[styles.timeInput, styles.timeRangeInput]}
                  value={startTimeText}
                  onChangeText={(v) => { setStartTimeText(v); setTimeError(""); }}
                  placeholder="9:00 AM"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.timeRangeSeparator}>{t("searchOptions.to")}</Text>
                <TextInput
                  style={[styles.timeInput, styles.timeRangeInput]}
                  value={endTimeText}
                  onChangeText={(v) => { setEndTimeText(v); setTimeError(""); }}
                  placeholder="6:00 PM"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>{t("searchOptions.time")}</Text>
              <TextInput
                style={styles.timeInput}
                value={timeText}
                onChangeText={(v) => { setTimeText(v); setTimeError(""); }}
                placeholder="6:30 PM"
                placeholderTextColor={colors.textMuted}
              />
            </>
          )}
          {timeError ? <Text style={styles.errorText}>{timeError}</Text> : null}

          <Text style={styles.label}>{t("searchOptions.seats")}</Text>
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
              <Text style={styles.cancelButtonText}>{t("searchOptions.cancel")}</Text>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>{t("searchOptions.done")}</Text>
            </Pressable>
          </View>
        </View>
        </Animated.View>
      </KeyboardAvoider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  avoiderBackdrop: { flex: 1, justifyContent: "flex-end" },
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
  dateChipTextActive: { color: colors.accentText, fontWeight: "700" },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  timeInput: {
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  timeRangeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  timeRangeInput: { flex: 1 },
  timeRangeSeparator: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
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
