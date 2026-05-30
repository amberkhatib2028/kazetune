// "Have we shown the user the How it works modal yet?"
//
// Persisted in AsyncStorage so it survives app restarts. We don't
// gate on Supabase session — first-launch onboarding is a per-install
// concept, not a per-user concept. Reinstall the app and you'll see
// it again.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'kazetune:onboardingShown';

export async function isOnboardingShown(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markOnboardingShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Best-effort; if storage is full the next launch will still
    // show the modal which is fine.
  }
}

/** Useful for testing — exposed via Settings → "Show How It Works again". */
export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}
