import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SplashScreen, OnboardingScreen } from "./src/screens/SplashOnboardingScreens";
import { PhoneEntryScreen, OtpVerifyScreen } from "./src/screens/OtpScreens";
import RegisterScreen from "./src/screens/RegisterScreen";
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
import EarningsScreen from "./src/screens/EarningsScreen";
import DocumentUploadScreen from "./src/screens/DocumentUploadScreen";
import EditRideScreen from "./src/screens/EditRideScreen";

import PaymentScreen from "./src/screens/PaymentScreen";
import LocationSearchScreen from "./src/screens/LocationSearchScreen";
import MapPinConfirmScreen from "./src/screens/MapPinConfirmScreen";
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

import { SettingsScreen, HelpSupportScreen, AboutScreen } from "./src/screens/SettingsScreens";
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

export default function App() {
  return (
    <SafeAreaProvider>
    <ToastProvider>
    <NavigationContainer>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <AlertModalHost />
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
        {/* Launch */}
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />

        {/* Auth */}
        <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
        <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />

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
        <Stack.Screen name="EditVehicle" component={EditVehicleScreen} />
        <Stack.Screen name="Earnings" component={EarningsScreen} />
        <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
        <Stack.Screen name="EditRide" component={EditRideScreen} />
        <Stack.Screen name="PaymentQueue" component={PaymentQueueScreen} />

        {/* Payments */}
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="MyRequests" component={MyRequestsScreen} />

        {/* Location picker + permission priming */}
        <Stack.Screen name="LocationSearch" component={LocationSearchScreen} />
        <Stack.Screen name="MapPinConfirm" component={MapPinConfirmScreen} />
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
        <Stack.Screen name="LanguageSelection" component={LanguageSelectionScreen} />
        <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
        <Stack.Screen name="About" component={AboutScreen} />

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
  );
}
