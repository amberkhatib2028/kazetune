// Lightweight in-app notifications: tracks how many incoming friend
// requests are pending so we can badge the Friends tab. Refreshes on
// mount, when the app returns to the foreground, on auth changes, and on
// a slow poll. Call refresh() after acting on a request to update
// immediately.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { listFriendSummary } from './friends';
import { supabase } from './supabase';

type Ctx = { incomingCount: number; refresh: () => void };

const NotificationsCtx = createContext<Ctx>({
  incomingCount: 0,
  refresh: () => {},
});

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [incomingCount, setIncomingCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setIncomingCount(0);
        return;
      }
      const summary = await listFriendSummary();
      setIncomingCount(
        summary.filter((s) => s.status === 'pending_incoming').length,
      );
    } catch {
      // Network blip — keep the last known count.
    }
  }, []);

  useEffect(() => {
    refresh();
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const interval = setInterval(refresh, 45_000);
    const { data: authSub } = supabase.auth.onAuthStateChange(() => refresh());
    return () => {
      appSub.remove();
      clearInterval(interval);
      authSub.subscription.unsubscribe();
    };
  }, [refresh]);

  return (
    <NotificationsCtx.Provider value={{ incomingCount, refresh }}>
      {children}
    </NotificationsCtx.Provider>
  );
}

export function useNotifications(): Ctx {
  return useContext(NotificationsCtx);
}
