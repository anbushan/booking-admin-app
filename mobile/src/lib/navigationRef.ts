import { createNavigationContainerRef } from "@react-navigation/native";

// Lets code outside any screen component (AppSocketBridge's socket
// event handlers, specifically) trigger navigation — attached to
// NavigationContainer in App.tsx.
export const navigationRef = createNavigationContainerRef();
