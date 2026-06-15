// Sign-in screen — only entry point when there's no Supabase session.
// A sunset-gradient hero with a single "Sign in with Spotify" button.

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { SunsetGradient } from '@/components/Gradient';
import { createSessionFromUrl, supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const SPOTIFY_SCOPES =
  'user-read-email user-read-private streaming user-modify-playback-state user-read-playback-state user-read-currently-playing';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const signInWithSpotify = async () => {
    try {
      setErrorText(null);
      setLoading(true);
      // Force the app's deep link scheme. Without this, makeRedirectUri()
      // in a dev build can return the Expo dev server URL (e.g.
      // http://localhost:8081), which Safari on the simulator can't
      // load → Spotify's OAuth callback dead-ends. `native:` takes
      // precedence over all other detection per the SDK 55 docs.
      const redirectTo = makeRedirectUri({ native: 'kazetune://' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'spotify',
        options: { redirectTo, skipBrowserRedirect: true, scopes: SPOTIFY_SCOPES },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Supabase returned no OAuth URL');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        await createSessionFromUrl(result.url);
      }
    } catch (err: any) {
      setErrorText(err?.message ?? 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SunsetGradient
      style={styles.container}
      colors={['#FFC9A9', '#FF8FA3', '#C89BE0']}
    >
      <Text style={styles.title}>KazeTune</Text>
      <Text style={styles.subtitle}>Go where the wind takes you.</Text>

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={signInWithSpotify}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FF6F91" />
        ) : (
          <Text style={styles.buttonText}>Sign in with Spotify</Text>
        )}
      </Pressable>

      {errorText && <Text style={styles.error}>{errorText}</Text>}
    </SunsetGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 54,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(120,60,90,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 28,
    textShadowColor: 'rgba(120,60,90,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  button: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 30,
    minWidth: 240,
    alignItems: 'center',
    shadowColor: '#7A3C5A',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#FF6F91' },
  error: {
    marginTop: 16,
    textAlign: 'center',
    color: '#fff',
    fontWeight: '600',
  },
});
