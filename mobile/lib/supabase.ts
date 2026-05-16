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
// Parse them out and tell supabase-js about the session.
export async function createSessionFromUrl(url: string) {
  const hashIndex = url.indexOf('#');
  if (hashIndex < 0) return null;
  const params = new URLSearchParams(url.substring(hashIndex + 1));

  const errorCode = params.get('error_code') || params.get('error');
  if (errorCode) throw new Error(errorCode);

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  return data.session;
}
