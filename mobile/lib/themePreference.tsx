// User-overridable color-scheme preference.
//
// Stores 'light' | 'dark' | 'system' in AsyncStorage and exposes:
//   - useThemePreference(): { pref, resolved, setPref } for the settings UI
//   - useResolvedScheme(): the 'light' | 'dark' actually used by the UI
//
// Consumed by:
//   - components/Themed.tsx → useThemeColors()
//   - app/_layout.tsx → nav DarkTheme/DefaultTheme
//   - app/settings.tsx → the toggle
//
// The provider sits inside RootLayoutNav (above the navigation Stack) so
// every screen has access. We import the SSR-safe useColorScheme shim
// from @/components/useColorScheme rather than reaching into 'react-native'
// directly — same reason the existing supabase client uses a no-op
// storage adapter on the server.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useColorScheme } from '@/components/useColorScheme';

export type ThemePref = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'kazetune:themePref';

type Ctx = {
  pref: ThemePref;
  resolved: 'light' | 'dark';
  setPref: (p: ThemePref) => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');

  // Load the persisted preference once on mount.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') {
        setPrefState(v);
      }
    });
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const resolved: 'light' | 'dark' =
    pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;

  const value = useMemo(
    () => ({ pref, resolved, setPref }),
    [pref, resolved, setPref],
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useThemePreference() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) {
    throw new Error(
      'useThemePreference must be used inside ThemePreferenceProvider',
    );
  }
  return ctx;
}

// Safe to call even outside the provider (returns 'light' as a fallback),
// so Themed.tsx works during the brief pre-provider render.
export function useResolvedScheme(): 'light' | 'dark' {
  const ctx = useContext(ThemeCtx);
  return ctx?.resolved ?? 'light';
}
