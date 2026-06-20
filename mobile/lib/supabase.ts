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

// KazeTune is a Premium-exclusive app: full-track playback (its whole
// point) only works on Spotify Premium. We gate at login so non-Premium
// users get a clear explanation instead of an app that silently fails to
// play anything. Thrown from createSessionFromUrl before a session is
// ever established, so login.tsx can show the right screen.
export class PremiumRequiredError extends Error {
  constructor() {
    super('Spotify Premium required');
    this.name = 'PremiumRequiredError';
  }
}

// Read the account tier from Spotify's profile endpoint. `product` is
// 'premium' | 'free' | 'open'. Returns null on any failure so callers
// can fail OPEN — we never want a flaky network to lock out a real
// Premium user. Requires the `user-read-private` scope (we request it).
export async function fetchSpotifyProduct(token: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.product === 'string' ? data.product : null;
  } catch {
    return null;
  }
}

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
    // Premium gate: verify the tier BEFORE establishing a session, so a
    // non-Premium user is never signed in (no flash into a broken app).
    // Fails open — only an explicit non-premium answer blocks.
    const product = await fetchSpotifyProduct(provider_token);
    if (product && product !== 'premium') {
      await clearSpotifyTokens();
      throw new PremiumRequiredError();
    }
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

// Spotify access tokens expire after ~1 hour. We can't refresh in the
// app (that needs the client secret), so the `spotify-refresh` Edge
// Function does it server-side. Returns the new access token (and
// persists it), or null if there's no refresh token / it failed.
export async function refreshSpotifyToken(): Promise<string | null> {
  const tokens = await getSpotifyTokens();
  if (!tokens?.provider_refresh_token) return null;
  try {
    const { data, error } = await supabase.functions.invoke('spotify-refresh', {
      body: { refresh_token: tokens.provider_refresh_token },
    });
    if (error || !data?.access_token) return null;
    await saveSpotifyTokens({
      provider_token: data.access_token,
      // Spotify occasionally rotates the refresh token; keep the old one
      // if it didn't send a new one.
      provider_refresh_token: data.refresh_token ?? tokens.provider_refresh_token,
    });
    return data.access_token as string;
  } catch {
    return null;
  }
}
