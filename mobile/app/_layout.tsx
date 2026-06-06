import 'react-native-gesture-handler';
import '@/lib/setupGlobals';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

import { PushTokenSync } from '@/components/PushTokenSync';
import { AuthProvider } from '@/contexts/AuthContext';
import { configurePlaybackAudioMode } from '@/lib/audioSession';
import { configureNotificationBehavior } from '@/lib/notificationBehavior';
import { configureGoogleSignIn } from '@/lib/oauthSignIn';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    void configureGoogleSignIn();
  }, []);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

const NAVY = "#2C3E6B";

const skinfitNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: NAVY,
    background: "#E8EFE6",
    card: "#E8EFE6",
    text: NAVY,
    border: "transparent",
    notification: "#0d9488",
  },
};

function RootLayoutNav() {
  const theme = useMemo(() => skinfitNavigationTheme, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      configureNotificationBehavior();
      void configurePlaybackAudioMode().catch(() => {
        /* ignore — retried before each playback/speech */
      });
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#E8EFE6" }}>
      <StatusBar style="dark" />
      <AuthProvider>
        <PushTokenSync />
        <ThemeProvider value={theme}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: "#E8EFE6" },
              headerTitleStyle: { fontWeight: "700", color: NAVY },
              headerShadowVisible: false,
              headerTintColor: NAVY,
              contentStyle: { backgroundColor: "#E8EFE6" },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen
              name="login"
              options={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }}
            />
            <Stack.Screen
              name="signup"
              options={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }}
            />
            <Stack.Screen
              name="forgot-password"
              options={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }}
            />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
          </Stack>
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
