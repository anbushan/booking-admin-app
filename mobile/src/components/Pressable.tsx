import React, { forwardRef } from "react";
import {
  Pressable as RNPressable,
  PressableProps,
  PressableStateCallbackType,
  View,
  StyleSheet,
  Platform,
} from "react-native";

// Drop-in replacement for RN's own `Pressable` — every one of this
// app's ~140 Pressables (buttons, cards, rows, chips) was using the
// bare RN component, which shows literally nothing when tapped unless
// you explicitly wire feedback yourself. Exactly one call site in the
// whole app did that (Home's "How it works" card, which swaps its own
// backgroundColor on press) — everywhere else a tap gave no visual
// acknowledgment at all.
//
// Rather than a generic opacity dip (which fades text/icons along with
// everything else, and doesn't read as "the background responded"),
// this gives every Pressable the same background-tint feel that one
// hand-rolled card already had:
//  - Android gets a native ripple, which *is* a background tint (a
//    colored circle expanding from the touch point) and already
//    respects the view's own rounded corners at the native level.
//  - iOS has no ripple concept, so a translucent dark overlay fades in
//    on press instead — sized to match whatever borderRadius the
//    caller's own style already uses (read via StyleSheet.flatten), so
//    it never pokes out past rounded corners the way a plain absolute
//    overlay would.
//
// Shadowing the import (`import { Pressable } from "../components/
// Pressable"` instead of "react-native") means every existing call site
// gets this for free with zero JSX changes. Pass `noFeedback` only for
// the handful of Pressables that are themselves invisible full-screen
// tap-catchers (KeyboardAvoider's dismiss layer, a sheet's
// backdrop-tap-to-close) — a tint appearing on blank space reads as a
// glitch, not feedback, since there's no visible "button" there.
type Props = PressableProps & { noFeedback?: boolean };

const RIPPLE = { color: "rgba(0,0,0,0.10)" };
const OVERLAY_COLOR = "rgba(0,0,0,0.08)";
const RADIUS_KEYS = [
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
] as const;

export const Pressable = forwardRef<React.ElementRef<typeof RNPressable>, Props>(
  function Pressable({ style, children, noFeedback, android_ripple, ...rest }, ref) {
    if (noFeedback) {
      return (
        <RNPressable ref={ref} style={style} {...rest}>
          {children}
        </RNPressable>
      );
    }

    return (
      <RNPressable ref={ref} android_ripple={android_ripple ?? RIPPLE} style={style} {...rest}>
        {(state: PressableStateCallbackType) => {
          const content = typeof children === "function" ? children(state) : children;
          if (Platform.OS !== "ios" || !state.pressed) return content;

          const resolved = StyleSheet.flatten(typeof style === "function" ? style(state) : style) || {};
          const radiusStyle: Record<string, number> = {};
          for (const key of RADIUS_KEYS) {
            if (typeof resolved[key] === "number") radiusStyle[key] = resolved[key];
          }

          return (
            <>
              {content}
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, radiusStyle, { backgroundColor: OVERLAY_COLOR }]} />
            </>
          );
        }}
      </RNPressable>
    );
  }
);
