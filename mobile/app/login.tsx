// Sign-in screen — only entry point when there's no Supabase session.
// Single "Sign in with Spotify" button kicks off the OAuth flow.

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { Text, View, useThemeColors } from '@/components/Themed';
import { createSessionFromUrl, supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const SPOTIFY_SCOPES =
  'user-read-email user-read-private streaming user-modify-playback-state user-read-playback-state user-read-currently-playing';

export default function LoginScreen() {
  const c = useThemeColors();
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const signInWithSpotify = async () => {
    try {
      setErrorText(null);
      setLoading(true);
      const redirectTo = makeRedirectUri();
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
    <View style={styles.container}>
      <Text style={styles.title}>kazetune</Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>
        Pin songs to places.
      </Text>

      <Pressable
        style={[
          styles.button,
          { backgroundColor: c.primary },
          loading && styles.buttonDisabled,
        ]}
        onPress={signInWithSpotify}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={c.primaryText} />
        ) : (
          <Text style={[styles.buttonText, { color: c.primaryText }]}>
            Sign in with Spotify
          </Text>
        )}
      </Pressable>

      {errorText && (
        <Text style={[styles.error, { color: c.danger }]}>{errorText}</Text>
      )}
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
  subtitle: { fontSize: 18, marginBottom: 24 },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
    minWidth: 240,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  error: { marginTop: 16, textAlign: 'center' },
});
