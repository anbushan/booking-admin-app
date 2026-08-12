import * as Sentry from "@sentry/react-native";

// Crash + JS-error reporting for production. Unlike lib/analytics.ts
// (deliberately stubbed until @react-native-firebase/analytics gets
// wired in), this is wired up for real — a crash a user hits in
// production is otherwise completely invisible; there's no way to know
// it happened, let alone why, without something like this.
//
// DSN: same "hardcoded constant with a comment," not dotenv — matches
// this file's own lib/api.ts (API_BASE_URL) rather than introducing a
// new EXPO_PUBLIC_* env-var convention nothing else here uses. A Sentry
// DSN is a publishable identifier (it's meant to ship inside client
// bundles — see Sentry's own docs), not a secret, so hardcoding it is
// the normal, supported approach, the same as Firebase's own
// google-services.json values.
//
// Get yours: sentry.io → create a project (choose "React Native") → the
// DSN is shown on setup and under Settings → Projects → [project] →
// Client Keys (DSN). Paste it below; leave it empty to leave crash
// reporting off (init() below no-ops safely either way, so an empty
// string is safe to ship, it just means nothing gets captured).
const SENTRY_DSN = "";

// NOTE on the native side: "@sentry/react-native" was removed from
// app.json's `plugins` array (see git history) after it broke the first
// real EAS build. That Expo config plugin unconditionally injects a
// sentry.gradle hook into android/app/build.gradle for native crash
// symbolication + source-map upload — even with no DSN/org/project
// configured, and even with SENTRY_DISABLE_AUTO_UPLOAD=true (which only
// skips the upload task itself; a separate `finalizedBy`-chained
// "collect modules" task in that same script still runs a Node script
// unconditionally whenever the file exists in node_modules, i.e.
// always). That's a real Gradle-build-time dependency this app has no
// use for yet, since there's no real Sentry project to symbolicate
// against (SENTRY_DSN above is empty). None of that affects the JS-side
// SDK below — Sentry.init/wrap/ErrorBoundary/setUser all work purely in
// JS regardless of the native plugin being present. Once a real DSN
// exists, re-add "@sentry/react-native" to app.json's plugins AND set
// real SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN (via `eas secret` or
// eas.json env) before the next build, so the native hook has something
// real to authenticate against instead of failing again.


export function initErrorTracking() {
  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: !!SENTRY_DSN,
    // Keeps dev-time noise (every red-box during active development) out
    // of the same Sentry project real users' crashes land in — filter by
    // this in Sentry's UI, or just trust __DEV__ builds never send at all
    // once a real DSN is filled in above and this still reads "development".
    environment: __DEV__ ? "development" : "production",
    // Sends a fraction of normal (non-error) app activity as performance
    // traces — useful for "why is this screen slow" later, but the
    // primary ask here is crash/error visibility, not perf monitoring,
    // so this stays low rather than defaulting to 1.0 (100%) and eating
    // into Sentry's free-tier event quota on traces nobody's asked for
    // yet.
    tracesSampleRate: 0.2,
  });
}

// Called from OtpScreens.tsx's completeLogin/logout, mirroring
// Analytics.login()/logout()'s own call sites — ties a crash report back
// to which account hit it (by internal id only, never phone/name/email;
// see the id-not-phone note below) without requiring every screen to
// remember to do this themselves.
export function setErrorTrackingUser(userId: string | null) {
  // Internal cuid, not the phone number — Sentry is a third-party
  // service; there's no reason to hand it anything that reads as PII
  // when an opaque id does the same job (matching a crash back to "which
  // account" via a support lookup, not identifying the person to Sentry
  // itself).
  Sentry.setUser(userId ? { id: userId } : null);
}

// Wrap the root App component with this in App.tsx — adds Sentry's own
// top-level error boundary (catches a render-time crash that would
// otherwise be a white/red screen with nothing reported) plus automatic
// touch-event breadcrumbs, so a crash report comes with "what did they
// tap right before this" for free.
export const wrapRootComponent = Sentry.wrap;

// Re-exported so App.tsx's fallback UI (a friendly "something went
// wrong" screen, not Sentry's default) can still report the exact error
// it's recovering from — see Sentry.ErrorBoundary's `beforeCapture` /
// the component itself, used directly in App.tsx.
export { Sentry };
