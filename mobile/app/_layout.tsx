import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Session } from '@supabase/supabase-js';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { isOnboardingShown, markOnboardingShown } from '@/lib/onboarding';
import { supabase } from '@/lib/supabase';
// Side-effect import: runs the module-top-level TaskManager.defineTask
// for our background geofence task. Required by expo-task-manager (the
// task must be defined before iOS/Android tries to invoke it on a
// background wake-up). Keep this above any other top-level work.
import '@/lib/backgroundGeofencing';
import {
  ThemePreferenceProvider,
  useResolvedScheme,
} from '@/lib/themePreference';
import { WalkingPreferenceProvider } from '@/lib/walkingPreference';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  // ThemePreferenceProvider has to wrap everything that reads theme —
  // including the nav <ThemeProvider> below — so an inner component
  // (NavStack) reads the resolved scheme from context.
  return (
    <ThemePreferenceProvider>
      <WalkingPreferenceProvider>
        <NavStack />
      </WalkingPreferenceProvider>
    </ThemePreferenceProvider>
  );
}

function NavStack() {
  const colorScheme = useResolvedScheme();
  const router = useRouter();
  const segments = useSegments();

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Load any existing session on mount and subscribe to future changes
  // (login, logout, token refresh).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // Auth gate: keep unauthenticated users on /login, send them onward
  // once a session shows up.
  useEffect(() => {
    if (!authReady) return;
    const onLoginScreen = segments[0] === 'login';
    if (!session && !onLoginScreen) {
      router.replace('/login');
    } else if (session && onLoginScreen) {
      router.replace('/(tabs)');
    }
  }, [authReady, session, segments, router]);

  // First-launch onboarding: pop the "How it works" modal once after
  // the user is signed in and on the tabs. We check exactly once per
  // session-mount; subsequent reopens of the modal go through the (i)
  // button on the Map tab.
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  useEffect(() => {
    if (!authReady || !session || onboardingChecked) return;
    if (segments[0] === 'login') return; // wait until past the auth gate
    setOnboardingChecked(true);
    (async () => {
      if (await isOnboardingShown()) return;
      await markOnboardingShown();
      // Small defer so the (tabs) route has a chance to mount before
      // we stack the modal on top — otherwise router.push can no-op.
      setTimeout(() => router.push('/modal'), 300);
    })();
  }, [authReady, session, segments, router, onboardingChecked]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen
          name="create-pin"
          options={{ presentation: 'modal', title: 'New pin' }}
        />
        <Stack.Screen
          name="pick-song-for-location"
          options={{ presentation: 'modal', title: 'Pick a song' }}
        />
        <Stack.Screen
          name="pin-detail"
          options={{ presentation: 'modal', title: 'Pin' }}
        />
        <Stack.Screen
          name="edit-pin"
          options={{ presentation: 'modal', title: 'Edit pin' }}
        />
        <Stack.Screen
          name="playlist-detail"
          options={{ presentation: 'modal', title: 'Playlist' }}
        />
        <Stack.Screen
          name="add-to-playlist"
          options={{ presentation: 'modal', title: 'Add to playlist' }}
        />
        <Stack.Screen
          name="settings"
          options={{ presentation: 'modal', title: 'Settings' }}
        />
        <Stack.Screen
          name="add-friend/[username]"
          options={{ presentation: 'modal', title: 'Add friend' }}
        />
        <Stack.Screen
          name="walk-summary"
          options={{ presentation: 'modal', title: 'Walk' }}
        />
        <Stack.Screen
          name="playlist-route"
          options={{ presentation: 'modal', title: 'Route' }}
        />
        <Stack.Screen
          name="modal"
          options={{ presentation: 'modal', title: 'How it works' }}
        />
      </Stack>
    </ThemeProvider>
  );
}
