const { withAndroidStyles } = require("@expo/config-plugins");

// Android 10+ auto-inverts ("Force Dark") any app it decides isn't
// dark-mode-aware whenever the device is in system dark mode — this
// runs at the native rendering layer, AFTER the app has already drawn
// its (correctly, explicitly colored) text, so it silently turns dark
// navy/black text white regardless of what color the JS style actually
// sets. It's on by default for any app targeting API 29+ (this one
// targets 35) unless the app's own theme opts out.
//
// Expo Go itself never shows this bug because it already ships with
// force-dark disabled in its own bundled theme — a real EAS build
// generates its own native theme from scratch and gets Android's
// default (force-dark ON), which is exactly why "text is invisible in
// the built APK but fine in Expo Go" only shows up post-build.
//
// This plugin adds `android:forceDarkAllowed="false"` to the app's
// base theme so the OS never touches colors this app already set on
// purpose. Paired with `userInterfaceStyle: "light"` (needs
// expo-system-ui to actually take effect in a standalone build) so the
// whole app renders in one consistent theme regardless of the device's
// system dark-mode setting.
module.exports = function withDisableForceDark(config) {
  return withAndroidStyles(config, (config) => {
    const styles = config.modResults;
    const appTheme = styles.resources.style?.find(
      (s) => s.$.name === "AppTheme"
    );
    if (appTheme) {
      appTheme.item = appTheme.item || [];
      const existing = appTheme.item.find((i) => i.$.name === "android:forceDarkAllowed");
      if (existing) {
        existing._ = "false";
      } else {
        appTheme.item.push({ $: { name: "android:forceDarkAllowed" }, _: "false" });
      }
    }
    return config;
  });
};
