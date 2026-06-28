// Local (on-device) notifications. These need NO Apple Developer account
// / APNs — the app schedules them itself. We use them so that when a pin
// fires during a BACKGROUND walk (phone in your pocket), you get a
// "🎵 now playing here" banner, not just silent audio.
//
// Remote push (alerts when the app is fully closed, e.g. friend
// requests) is a separate thing that DOES need APNs credentials from a
// paid Apple Developer account — see docs/push-notifications.md.

import * as Notifications from 'expo-notifications';

// Show banners even when the app is foregrounded (SDK 53+ uses
// shouldShowBanner/shouldShowList instead of the old shouldShowAlert).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Ask for notification permission if we don't already have it. Returns
 *  whether it's granted. Safe to call repeatedly. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.status === 'granted') return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted || req.status === 'granted';
  } catch {
    return false;
  }
}

/** Fire an immediate local notification for a pin the user just walked
 *  into. Best-effort — never throws. */
export async function notifyPinNearby(pin: {
  track_name: string;
  place_name: string | null;
}): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🎵 ${pin.track_name}`,
        body: pin.place_name
          ? `Now playing — you're at ${pin.place_name}`
          : 'Now playing — a pin near you',
      },
      trigger: null, // immediate
    });
  } catch {
    // best-effort; audio still plays regardless
  }
}
