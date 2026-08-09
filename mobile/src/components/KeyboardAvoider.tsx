import React from "react";
import { KeyboardAvoidingView, Keyboard, Platform, View, StyleSheet, ViewStyle } from "react-native";
import { Pressable } from "./Pressable";
// The one keyboard-avoidance treatment for every screen with a text
// input. `behavior="padding"` is the standard iOS fix. Android used to
// get `undefined` here on the theory that app.json's
// `softwareKeyboardLayoutMode: "resize"` alone would handle it — that
// held in a standalone build, but not in Expo Go, which runs its own
// manifest and doesn't pick up the project's window-resize setting.
// `"height"` makes this component actively resize itself in JS on
// Android too, so it behaves the same in Expo Go, a dev client, and a
// real build, instead of depending on which shell happens to honor the
// native manifest setting.
//
// Tapping empty background also dismisses the keyboard — but NOT via a
// Pressable wrapping `children` directly. A wrapping Pressable sits in
// the same responder zone as everything inside it, including this
// app's OTP screen (an invisible, full-row TextInput layered over
// visual boxes rather than a normal input) — that combination let the
// wrapper's onPress fire right alongside the input claiming focus,
// dismissing the keyboard the instant it opened and making the field
// effectively untypable. Instead, the dismiss-catcher is a separate
// layer positioned *behind* children (rendered first, so it's furthest
// back); `children`'s own wrapper is `pointerEvents="box-none"`, which
// means it never claims a touch itself and lets empty space fall
// through to the layer behind it, while any real child (button, input,
// however unusual) still gets first claim on touches that land on it —
// correct by construction, not by hoping negotiation heuristics land
// the right way for every input pattern in the app.
export function KeyboardAvoider({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} accessible={false} noFeedback />
      {/* `style` (e.g. a caller's centering/backdrop styles) has to land on
          THIS box — the one actually holding `children` — not the outer
          KeyboardAvoidingView. It used to go on the outer view, which left
          this inner box as a bare `{flex:1}` with default flex-start/stretch
          alignment, so anything a caller centered (StartTripScreen's loader,
          RateReviewScreen's form) silently pinned to the top-left instead. */}
      <View style={[{ flex: 1 }, style]} pointerEvents="box-none">
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}
