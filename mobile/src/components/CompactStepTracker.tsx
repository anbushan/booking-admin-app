import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/theme";
import { TrackerStep } from "./StepTracker";

// A horizontal, single-line version of StepTracker's dot-and-rail idea
// for places a full vertical journey per row would be too tall — a
// list of queue cards, each needing "where's this one right now" at a
// glance, not a full read.
export function CompactStepTracker({ steps }: { steps: TrackerStep[] }) {
  return (
    <View style={styles.row}>
      {steps.map((step, i) => (
        <React.Fragment key={step.key}>
          <View style={[styles.dot, step.state === "done" && styles.dotDone, step.state === "active" && styles.dotActive]}>
            {step.state === "done" && <Ionicons name="checkmark" size={9} color="#FFFFFF" />}
          </View>
          {i < steps.length - 1 && (
            <View style={[styles.line, { backgroundColor: step.state === "done" ? colors.success : colors.border }]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
  dotActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  line: { flex: 1, height: 2, marginHorizontal: 2 },
});
