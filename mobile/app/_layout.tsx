import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Session } from '@supabase/supabase-js';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { isOnboardingShown, markOnboardingShown } from '@/lib/onboarding';
import { supabase } from '@/lib/supabase';
// Side-effect import: runs the module-top-level TaskManager.defineTask
// for our background geofence task. Required by expo-task-manager (the
// task must be defined before iOS/Android tries to invoke it on a
// background wake-up). Keep this above any other top-level work.
import '@/lib/backgroundGeofencing';
import { NotificationsProvider } from '@/lib/notifications';
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

// Custom navigation themes so the header + tab bar use our cream/plum
// palette instead of React Navigation's default white/black chrome.
// card = background makes the header and tab bar blend seamlessly.
const navLight = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.light.background,
    card: Colors.light.background,
    text: Colors.light.text,
    border: Colors.light.separator,
    primary: Colors.light.primary,
    notification: Colors.light.primary,
  },
};
const navDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.dark.background,
    card: Colors.dark.background,
    text: Colors.dark.text,
    border: Colors.dark.separator,
    primary: Colors.dark.primary,
    notification: Colors.dark.primary,
  },
};

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
        <NotificationsProvider>
          <NavStack />
        </NotificationsProvider>
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
  // null = not yet checked for the current user. Once true we stop
  // re-checking; we only keep polling while a user still has no handle.
  const [hasUsername, setHasUsername] = useState<boolean | null>(null);

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

  // Reset the username check whenever the signed-in user changes.
  useEffect(() => {
    setHasUsername(null);
  }, [session?.user?.id]);

  // Auth + username gate:
  //   • no session            → /login
  //   • signed in, no handle   → /choose-username (required once)
  //   • signed in, has handle  → into the app
  useEffect(() => {
    if (!authReady) return;
    const onLogin = segments[0] === 'login';
    const onChoose = segments[0] === 'choose-username';

    if (!session) {
      if (!onLogin) router.replace('/login');
      return;
    }

    if (hasUsername === true) {
      if (onLogin || onChoose) router.replace('/(tabs)');
      return;
    }

    // Username unknown or missing — check the profile. (Only runs until
    // a handle exists, so it's not a per-navigation cost for most users.)
    let cancelled = false;
    supabase
      .from('profiles')
      .select('username')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        // On a transient fetch error, leave the check unresolved so we
        // retry rather than wrongly gating a user who already has a handle.
        if (cancelled || error) return;
        const has = !!data?.username;
        setHasUsername(has);
        if (!has) {
          if (!onChoose) router.replace('/choose-username');
        } else if (onLogin || onChoose) {
          router.replace('/(tabs)');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, session, hasUsername, segments, router]);

  // First-launch onboarding: pop the "How it works" modal once after
  // the user is signed in and on the tabs. We check exactly once per
  // session-mount; subsequent reopens of the modal go through the (i)
  // button on the Map tab.
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  useEffect(() => {
    if (!authReady || !session || onboardingChecked) return;
    // Wait until past the auth + username gates before stacking the modal.
    if (segments[0] === 'login' || segments[0] === 'choose-username') return;
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
    <ThemeProvider value={colorScheme === 'dark' ? navDark : navLight}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="choose-username" options={{ headerShown: false }} />
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
        <Stack.Screen name="user/[id]" options={{ title: 'Profile' }} />
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
