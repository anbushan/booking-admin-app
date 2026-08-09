import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme/theme";

// The one "no data" illustration for the whole app — an empty fuel
// gauge (needle on E), replacing the assortment of per-screen icon
// circles EmptyState/NoRidesFound used to show. Built from plain Views
// (rotated bars arranged around an arc, same technique as CarLoader)
// rather than a shipped image asset — no new dependency, nothing to
// bundle.
const TICK_COUNT = 17;
const START_DEG = 174; // just short of full left (E)
const END_DEG = 6; // just short of full right (F)
const NEEDLE_DEG = 163; // resting near-empty, angled slightly above horizontal

export function EmptyGauge({ size = 100 }: { size?: number }) {
  const scale = size / 100;
  const cx = size / 2;
  const cy = size * 0.6;
  const radius = size * 0.42;
  const tickLen = 11 * scale;
  const tickThick = 5 * scale;
  const needleLen = radius * 0.8;
  const needleThick = 4 * scale;
  const hubR = 6 * scale;

  const ticks = useMemo(() => {
    return Array.from({ length: TICK_COUNT }, (_, i) => {
      const t = i / (TICK_COUNT - 1);
      const deg = START_DEG - t * (START_DEG - END_DEG);
      const rad = (deg * Math.PI) / 180;
      const x = cx + radius * Math.cos(rad);
      const y = cy - radius * Math.sin(rad);
      // Base orientation (rotate: 0deg) is a vertical bar, which already
      // points radially outward at the top of the arc (deg=90) — every
      // other tick just needs the difference from that reference angle.
      return { x, y, rotate: 90 - deg, isEmpty: i === 0 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  return (
    <View style={{ width: size, height: cy + 16 * scale }}>
      {ticks.map((tk, i) => (
        <View
          key={i}
          style={[
            styles.tick,
            {
              left: tk.x - tickThick / 2,
              top: tk.y - tickLen / 2,
              width: tickThick,
              height: tickLen,
              borderRadius: tickThick / 2,
              backgroundColor: tk.isEmpty ? colors.danger : colors.textMuted,
              transform: [{ rotate: `${tk.rotate}deg` }],
            },
          ]}
        />
      ))}

      {/* Needle — a container spanning equally above and below the hub,
          so rotating it (around its own natural center) pivots correctly
          from the hub, not the needle's midpoint. Only the top half is
          drawn; the bottom half is the invisible counterweight. */}
      <View
        style={{
          position: "absolute",
          left: cx - needleThick / 2,
          top: cy - needleLen,
          width: needleThick,
          height: needleLen * 2,
          transform: [{ rotate: `${90 - NEEDLE_DEG}deg` }],
        }}
      >
        <View style={{ width: needleThick, height: needleLen, backgroundColor: colors.danger, borderRadius: needleThick / 2 }} />
      </View>

      <View style={[styles.hub, { left: cx - hubR, top: cy - hubR, width: hubR * 2, height: hubR * 2, borderRadius: hubR }]} />

      <Text style={[styles.label, { left: 0, top: cy - 4 * scale, color: colors.danger }]}>E</Text>
      <Text style={[styles.label, { right: 0, top: cy - 4 * scale }]}>F</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tick: { position: "absolute" },
  hub: { position: "absolute", backgroundColor: colors.textPrimary },
  label: { position: "absolute", fontWeight: "700", fontSize: 13, color: colors.textMuted },
});
