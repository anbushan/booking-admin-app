import React, { useEffect } from "react";
import { View } from "react-native";
// Namespace import, not a named one — this file already has its own
// `SplashScreen` (the JS screen component from SplashOnboardingScreens
// below); importing expo-splash-screen's own SplashScreen export under
// the same name would collide.
import * as ExpoSplashScreen from "expo-splash-screen";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
// Subpath imports, deliberately not the package's root barrel
// (`@expo-google-fonts/poppins`) — that barrel's index.js does a
// top-level `require()` for all 18 weight/style files (100–900, regular
// + italic) in one module. Metro bundles every `require()` it sees
// statically regardless of which named export actually gets used
// (there's no dead-code elimination for RN asset requires), so
// importing from the barrel would have silently pulled ~1.4MB of unused
// font files into the app — after the earlier bundle-size pass this
// session, that's exactly the kind of regression worth avoiding. Each
// subpath below is its own small module with only that one weight's
// `require()` in it.
import { useFonts } from "@expo-google-fonts/poppins/useFonts";
import { Poppins_400Regular } from "@expo-google-fonts/poppins/400Regular";
import { Poppins_500Medium } from "@expo-google-fonts/poppins/500Medium";
import { Poppins_600SemiBold } from "@expo-google-fonts/poppins/600SemiBold";
import { Poppins_700Bold } from "@expo-google-fonts/poppins/700Bold";
import { initErrorTracking, wrapRootComponent, Sentry } from "./src/lib/errorTracking";
import { CrashFallback } from "./src/components/CrashFallback";
import { colors } from "./src/theme/theme";

// Runs once at module load, before anything else in this file — the
// whole point is catching errors as early in the app's life as
// possible, so this can't wait until inside the App() component body.
initErrorTracking();

// Keeps the native splash screen (the app's own brand mark — see
// app.json's expo-splash-screen plugin config) on screen instead of
// letting it auto-dismiss the instant the native side is ready, which
// is well before Poppins has finished loading and this component has
// rendered anything real. Without this, there was a real gap between
// "native splash disappears" and "actual content appears," and with no
// splash config in app.json at all before this, Expo's own generic
// default filled that gap — that's the flash of Expo's own branding
// this fixes, not a timing bug in this app's JS. Failure here (e.g.
// called twice across a fast refresh) is harmless to swallow — the
// splash either shows or it doesn't, there's no broken state to recover
// from either way.
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

import { SplashScreen, OnboardingScreen } from "./src/screens/SplashOnboardingScreens";
import { AppSocketBridge } from "./src/components/AppSocketBridge";
import { navigationRef } from "./src/lib/navigationRef";
import MaintenanceScreen from "./src/screens/MaintenanceScreen";
import { PhoneEntryScreen, OtpVerifyScreen } from "./src/screens/OtpScreens";
import RegisterScreen from "./src/screens/RegisterScreen";
import SwitchRoleScreen from "./src/screens/SwitchRoleScreen";
import HomeScreen from "./src/screens/HomeScreen";
import SearchResultsScreen from "./src/screens/SearchResultsScreen";
import BookingConfirmScreen from "./src/screens/BookingConfirmScreen";
import TripOtpScreen from "./src/screens/TripOtpScreen";
import LiveTrackingScreen from "./src/screens/LiveTrackingScreen";

import AddVehicleScreen from "./src/screens/AddVehicleScreen";
import OfferRideScreen from "./src/screens/OfferRideScreen";
import RouteOptionsScreen from "./src/screens/RouteOptionsScreen";
import BookingRequestsScreen from "./src/screens/BookingRequestsScreen";
import StartTripScreen from "./src/screens/StartTripScreen";
import UpcomingTripsScreen from "./src/screens/UpcomingTripsScreen";
import VehicleListScreen from "./src/screens/VehicleListScreen";
import EditVehicleScreen from "./src/screens/EditVehicleScreen";
import VerifyDriverScreen from "./src/screens/VerifyDriverScreen";
import VerifyPassengerScreen from "./src/screens/VerifyPassengerScreen";
import EarningsScreen from "./src/screens/EarningsScreen";
import EditRideScreen from "./src/screens/EditRideScreen";

import PaymentScreen from "./src/screens/PaymentScreen";
import LocationSearchScreen from "./src/screens/LocationSearchScreen";
import MapPinConfirmScreen from "./src/screens/MapPinConfirmScreen";
import RouteMapScreen from "./src/screens/RouteMapScreen";
import LocationPermissionPrimingScreen from "./src/screens/LocationPermissionPrimingScreen";
import { EmergencyContactsScreen, AddEmergencyContactScreen } from "./src/screens/EmergencyContactScreens";

import ChatListScreen from "./src/screens/ChatListScreen";
import ChatDetailScreen from "./src/screens/ChatDetailScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";

import HistoryScreen from "./src/screens/HistoryScreen";
import RateReviewScreen from "./src/screens/RateReviewScreen";
import { ProfileScreen, EditProfileScreen } from "./src/screens/ProfileScreens";
import PublicProfileScreen from "./src/screens/PublicProfileScreen";
import { ToastProvider } from "./src/components/Toast";
import { I18nProvider } from "./src/lib/i18n/I18nContext";

import { SettingsScreen, HelpSupportScreen, AboutScreen } from "./src/screens/SettingsScreens";
import DeleteAccountScreen from "./src/screens/DeleteAccountScreen";
import LoginPasscodeScreen from "./src/screens/LoginPasscodeScreen";
import LanguageSelectionScreen from "./src/screens/LanguageSelectionScreen";

import RatingsReceivedScreen from "./src/screens/RatingsReceivedScreen";
import BookingRequestDetailScreen from "./src/screens/BookingRequestDetailScreen";
import CompleteTripConfirmationScreen from "./src/screens/CompleteTripConfirmationScreen";
import PaymentHistoryScreen from "./src/screens/PaymentHistoryScreen";
import PaymentDetailScreen from "./src/screens/PaymentDetailScreen";
import RefundStatusScreen from "./src/screens/RefundStatusScreen";
import BookingDetailScreen from "./src/screens/BookingDetailScreen";
import PaymentQueueScreen from "./src/screens/PaymentQueueScreen";
import MyRequestsScreen from "./src/screens/MyRequestsScreen";
import AlertModalHost from "./src/components/AlertModalHost";

const Stack = createNativeStackNavigator();

// Not the default export directly — Sentry.wrap() below adds automatic
// touch-event breadcrumbs and its own top-level crash handling around
// this. The ErrorBoundary here is what actually renders something in
// place of a render-time crash (Sentry.wrap alone still reports it, but
// without this the user's left staring at a blank/white screen instead
// of a recoverable one) — placed outside every provider, deliberately,
// so a crash inside I18nProvider/SafeAreaProvider/ToastProvider
// themselves still gets caught rather than taking the boundary down
// with it.
function App() {
  // Gates the whole tree on Poppins being loaded (see theme.ts's FONT/
  // typography) rather than letting the app render once in the system
  // font and then visibly swap to Poppins a beat later — a blank screen
  // for the ~one-time load is less jarring than every piece of text on
  // the first screen re-flowing under it. `fontsError` falls through to
  // rendering anyway rather than getting stuck here forever — Text
  // components fall back to the system font if a named fontFamily never
  // loaded, which is a degraded look, not a broken app.
  const [fontsLoaded, fontsError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Hides the native splash (held open by preventAutoHideAsync above)
  // the moment there's real content to hand off to — this exact
  // condition, not a fixed delay, so the handoff is as tight as the
  // device's own font-load time rather than an arbitrary guess in
  // either direction. From here it goes straight into
  // SplashOnboardingScreens' own SplashScreen, which has its own
  // animated logo entrance — the native splash showing the same static
  // mark first is what makes that read as one continuous moment instead
  // of two splash screens back to back.
  useEffect(() => {
    if (fontsLoaded || fontsError) {
      ExpoSplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontsError]);

  if (!fontsLoaded && !fontsError) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <Sentry.ErrorBoundary fallback={({ resetError }) => <CrashFallback resetError={resetError} />}>
    <I18nProvider>
    <SafeAreaProvider>
    <ToastProvider>
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <AlertModalHost />
      <AppSocketBridge />
      {/* Explicit slide_from_right rather than the platform "default" —
          Android's default native-stack transition combines a fade with a
          scale, which is more expensive to composite and reads as choppy
          on mid-range devices (this app runs with New Architecture off,
          for react-native-razorpay compat, so there's no Fabric perf
          headroom to hide that). A single-axis translateX slide is cheap,
          GPU-friendly, and applies consistently on both push and
          navigation.replace() calls — this app leans on replace() a lot
          (Splash→Home, OTP→Home, TripOtp→LiveTracking, ...), and those
          were the transitions most likely to read as an abrupt cut. */}
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        {/* Launch */}
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Maintenance" component={MaintenanceScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />

        {/* Auth */}
        <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
        <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="SwitchRole" component={SwitchRoleScreen} />

        {/* Passenger */}
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="SearchResults" component={SearchResultsScreen} />
        <Stack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
        <Stack.Screen name="TripOtp" component={TripOtpScreen} />
        <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} />

        {/* Driver */}
        <Stack.Screen name="DriverOnboarding" component={AddVehicleScreen} />
        <Stack.Screen name="OfferRide" component={OfferRideScreen} />
        <Stack.Screen name="RouteOptions" component={RouteOptionsScreen} />
        <Stack.Screen name="BookingRequests" component={BookingRequestsScreen} />
        <Stack.Screen name="StartTrip" component={StartTripScreen} />
        <Stack.Screen name="UpcomingTrips" component={UpcomingTripsScreen} />
        <Stack.Screen name="ActiveTrip" component={LiveTrackingScreen} />
        <Stack.Screen name="VehicleList" component={VehicleListScreen} />
        <Stack.Screen name="VerifyDriver" component={VerifyDriverScreen} />
        <Stack.Screen name="VerifyPassenger" component={VerifyPassengerScreen} />
        <Stack.Screen name="EditVehicle" component={EditVehicleScreen} />
        <Stack.Screen name="Earnings" component={EarningsScreen} />
        <Stack.Screen name="EditRide" component={EditRideScreen} />
        <Stack.Screen name="PaymentQueue" component={PaymentQueueScreen} />

        {/* Payments */}
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="MyRequests" component={MyRequestsScreen} />

        {/* Location picker + permission priming */}
        <Stack.Screen name="LocationSearch" component={LocationSearchScreen} />
        <Stack.Screen name="MapPinConfirm" component={MapPinConfirmScreen} />
        <Stack.Screen name="RouteMap" component={RouteMapScreen} />
        <Stack.Screen name="LocationPermissionPriming" component={LocationPermissionPrimingScreen} />

        {/* Safety */}
        <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} />
        <Stack.Screen name="AddEmergencyContact" component={AddEmergencyContactScreen} />

        {/* Communication */}
        <Stack.Screen name="ChatList" component={ChatListScreen} />
        <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />

        {/* History, reviews, profile */}
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="RateReview" component={RateReviewScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />

        {/* Settings + static pages */}
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="LoginPasscode" component={LoginPasscodeScreen} />
        <Stack.Screen name="LanguageSelection" component={LanguageSelectionScreen} />
        <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
        <Stack.Screen name="About" component={AboutScreen} />
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />

        {/* Newly closed gaps */}
        <Stack.Screen name="RatingsReceived" component={RatingsReceivedScreen} />
        <Stack.Screen name="BookingRequestDetail" component={BookingRequestDetailScreen} />
        <Stack.Screen name="CompleteTripConfirmation" component={CompleteTripConfirmationScreen} />
        <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
        <Stack.Screen name="PaymentDetail" component={PaymentDetailScreen} />
        <Stack.Screen name="RefundStatus" component={RefundStatusScreen} />
        <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
    </ToastProvider>
    </SafeAreaProvider>
    </I18nProvider>
    </Sentry.ErrorBoundary>
  );
}

export default wrapRootComponent(App);
