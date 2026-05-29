import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Session } from '@supabase/supabase-js';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { supabase } from '@/lib/supabase';
import {
  ThemePreferenceProvider,
  useResolvedScheme,
} from '@/lib/themePreference';

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
      <NavStack />
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
          name="pin-detail"
          options={{ presentation: 'modal', title: 'Pin' }}
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
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
