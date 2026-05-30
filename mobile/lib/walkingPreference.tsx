// Whether to pick up public pins from other users during a walk.
//
// Three policies:
//   'always'      — Pick up public pins during both global Map walks
//                   AND playlist walks. Most discovery; default.
//   'global-only' — Pick up public during the global Map walk, but
//                   keep playlist walks focused on the playlist's pins.
//   'never'       — Only the user's own pins ever fire geofences.
//
// Lives in context so a tweak in Settings takes effect immediately
// (the next time the user toggles Start walking; we don't disturb a
// walk that's already in progress).

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

export type PublicPinPolicy = 'always' | 'global-only' | 'never';

const STORAGE_KEY = 'kazetune:publicPinPolicy';
const DEFAULT: PublicPinPolicy = 'always';

type Ctx = {
  policy: PublicPinPolicy;
  setPolicy: (p: PublicPinPolicy) => void;
};

const WalkingCtx = createContext<Ctx | null>(null);

export function WalkingPreferenceProvider({ children }: { children: ReactNode }) {
  const [policy, setPolicyState] = useState<PublicPinPolicy>(DEFAULT);

  // Load persisted value once.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'always' || v === 'global-only' || v === 'never') {
        setPolicyState(v);
      }
    });
  }, []);

  const setPolicy = useCallback((p: PublicPinPolicy) => {
    setPolicyState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const value = useMemo(() => ({ policy, setPolicy }), [policy, setPolicy]);

  return <WalkingCtx.Provider value={value}>{children}</WalkingCtx.Provider>;
}

export function useWalkingPreference(): Ctx {
  const ctx = useContext(WalkingCtx);
  if (!ctx) {
    throw new Error(
      'useWalkingPreference must be inside WalkingPreferenceProvider',
    );
  }
  return ctx;
}

/** Safe to call outside the provider — returns the default. Use this
 *  in walking screens that just want to read the current policy. */
export function usePublicPinPolicy(): PublicPinPolicy {
  const ctx = useContext(WalkingCtx);
  return ctx?.policy ?? DEFAULT;
}
