// Sign-in screen — only entry point when there's no Supabase session.
// Single "Sign in with Spotify" button kicks off the OAuth flow.

import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { createSessionFromUrl, supabase } from '@/lib/supabase';

// Required for OAuth flow on web; harmless on native.
WebBrowser.maybeCompleteAuthSession();

// Spotify scopes we'll need later for playback control + reading the
// user's library. Asking up front means no second consent prompt.
const SPOTIFY_SCOPES =
  'user-read-email user-read-private streaming user-modify-playback-state user-read-playback-state user-read-currently-playing';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const signInWithSpotify = async () => {
    try {
      setErrorText(null);
      setLoading(true);

      // makeRedirectUri() returns kazetune://... in dev/prod builds, and
      // an exp+kazetune:// URI in Expo Go. Either way it's pre-registered
      // in app.json's "scheme" so OAuth knows where to send the user back.
      const redirectTo = makeRedirectUri();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'spotify',
        options: {
          redirectTo,
          // Don't let supabase-js try to open the browser itself; we
          // open it via expo-web-browser so we control the result.
          skipBrowserRedirect: true,
          scopes: SPOTIFY_SCOPES,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Supabase returned no OAuth URL');

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );

      if (result.type === 'success') {
        await createSessionFromUrl(result.url);
        // _layout.tsx watches the session and redirects to (tabs).
      }
    } catch (err: any) {
      setErrorText(err?.message ?? 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>kazetune</Text>
      <Text style={styles.subtitle}>Pin songs to places.</Text>

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={signInWithSpotify}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in with Spotify</Text>
        )}
      </Pressable>

      {errorText && <Text style={styles.error}>{errorText}</Text>}
    </View>
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
  title: { fontSize: 48, fontWeight: '700' },
  subtitle: { fontSize: 18, opacity: 0.6, marginBottom: 24 },
  button: {
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
    minWidth: 240,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  error: { color: '#c00', marginTop: 16, textAlign: 'center' },
});
