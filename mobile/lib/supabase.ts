// Supabase client for kazetune.
//
// Reads URL + anon key from EXPO_PUBLIC_ env vars (set in .env.local).
// AsyncStorage persists the auth session across app restarts so the
// user stays logged in.

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Add them to mobile/.env.local and restart the dev server.'
  );
}

// During Expo's static web rendering there is no `window`, so AsyncStorage
// (which falls back to localStorage on web) crashes on import. Use a no-op
// adapter in that environment; real storage kicks in once we're in a browser.
const isServer = typeof window === 'undefined';
const serverStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isServer ? serverStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// After OAuth, Supabase redirects back with the access/refresh tokens in
// the URL hash: kazetune://#access_token=...&refresh_token=...
// Parse them out, capture the Spotify provider tokens (so we can call
// the Spotify API later), and hand the Supabase tokens to supabase-js.
export async function createSessionFromUrl(url: string) {
  console.log('[oauth callback] url:', url);
  const hashIndex = url.indexOf('#');
  if (hashIndex < 0) {
    console.warn('[oauth callback] no hash fragment in url');
    return null;
  }
  const params = new URLSearchParams(url.substring(hashIndex + 1));
  console.log('[oauth callback] param keys:', Array.from(params.keys()));

  const errorCode = params.get('error_code') || params.get('error');
  if (errorCode) throw new Error(errorCode);

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;

  // Capture Spotify's tokens before they vanish — supabase-js doesn't
  // persist them across reloads, but Spotify includes them in the URL
  // fragment on the redirect back.
  const provider_token = params.get('provider_token');
  const provider_refresh_token = params.get('provider_refresh_token');
  console.log('[oauth callback] provider_token present?', !!provider_token);
  if (provider_token) {
    await saveSpotifyTokens({ provider_token, provider_refresh_token });
  }

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  return data.session;
}

// --- Spotify provider token storage --------------------------------
// Supabase strips provider_token from the persisted session, so we
// stash it ourselves and read it back when calling the Spotify API.

const SPOTIFY_TOKEN_KEY = 'kazetune:spotify:tokens';

type SpotifyTokens = {
  provider_token: string;
  provider_refresh_token: string | null;
};

export async function saveSpotifyTokens(tokens: {
  provider_token: string;
  provider_refresh_token: string | null;
}) {
  if (isServer) return;
  await AsyncStorage.setItem(SPOTIFY_TOKEN_KEY, JSON.stringify(tokens));
}

export async function getSpotifyTokens(): Promise<SpotifyTokens | null> {
  if (isServer) return null;
  const raw = await AsyncStorage.getItem(SPOTIFY_TOKEN_KEY);
  return raw ? (JSON.parse(raw) as SpotifyTokens) : null;
}

export async function clearSpotifyTokens() {
  if (isServer) return;
  await AsyncStorage.removeItem(SPOTIFY_TOKEN_KEY);
}
