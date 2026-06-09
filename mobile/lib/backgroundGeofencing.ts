// Background geofencing — uses iOS/Android native geofences so songs
// keep firing even when the app is backgrounded or the phone is locked.
//
// The OS wakes the app when the user enters a region, invokes the
// TaskManager task we register below, and our handler tells Spotify to
// play the matching pin's clip (see lib/spotifyPlayback.ts). Audio is
// produced by the user's Spotify app over Spotify Connect, so it keeps
// playing in the background without us holding an audio session.
//
// Constraints / quirks:
//   • iOS limits an app to **20 simultaneous geofences**. We pick the
//     20 nearest to the user's location at start time. Android allows
//     up to 100 but we keep parity for simplicity.
//   • The task runs in a fresh JS context with no Supabase session.
//     We cache the pin set in AsyncStorage at start time so the task
//     can look up clip info by region.identifier (= pin.id).
//   • TaskManager.defineTask MUST be called at the top level of a
//     module — not inside React. app/_layout.tsx imports this file so
//     it runs on app startup.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { playPinClip, stopPinClip } from './spotifyPlayback';
import type { Pin } from './pins';

export const GEOFENCE_TASK_NAME = 'kazetune-walking-geofence';
const PIN_CACHE_KEY = 'kazetune:walking:pinCache';

// What the background task needs to play a clip. We strip Pin down so
// the JSON in AsyncStorage stays small.
type CachedPin = {
  id: string;
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  place_name: string | null;
  start_seconds: number;
  duration_seconds: number;
  latitude: number;
  longitude: number;
};

// Event names the React layer subscribes to. Fired in BOTH foreground
// (the same JS context) and background (a fresh JS context — emit is
// effectively a no-op for the React tree, but audio still plays).
export const GEOFENCE_EVENT_ENTER = 'kazetune:geofence:enter';
export const GEOFENCE_EVENT_EXIT  = 'kazetune:geofence:exit';

// ---- Task definition (runs in foreground AND background) -----------

TaskManager.defineTask(
  GEOFENCE_TASK_NAME,
  async ({ data, error }: any) => {
    if (error) {
      console.warn('[geofence task] error', error);
      return;
    }
    const eventType = data?.eventType;
    const region = data?.region;
    if (!region?.identifier) return;

    // Look up the cached pin info — set when walking started.
    let cache: Record<string, CachedPin> = {};
    try {
      const raw = await AsyncStorage.getItem(PIN_CACHE_KEY);
      if (raw) cache = JSON.parse(raw);
    } catch (e) {
      console.warn('[geofence task] cache read failed', e);
    }
    const pin = cache[region.identifier];
    if (!pin) return;

    // expo-location's GeofencingEventType: 1 = Enter, 2 = Exit. We
    // compare by number to avoid importing the enum here (some
    // platforms import-cycle).
    if (eventType === Location.GeofencingEventType.Enter || eventType === 1) {
      await playPinClip(pin as unknown as Pin);
      DeviceEventEmitter.emit(GEOFENCE_EVENT_ENTER, pin);
    } else if (
      eventType === Location.GeofencingEventType.Exit ||
      eventType === 2
    ) {
      await stopPinClip();
      DeviceEventEmitter.emit(GEOFENCE_EVENT_EXIT, pin);
    }
  },
);

// ---- Helpers --------------------------------------------------------

function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function toCached(pin: Pin): CachedPin {
  return {
    id: pin.id,
    spotify_track_id: pin.spotify_track_id,
    track_name: pin.track_name,
    artist_name: pin.artist_name,
    place_name: pin.place_name,
    start_seconds: pin.start_seconds,
    duration_seconds: pin.duration_seconds,
    latitude: pin.latitude,
    longitude: pin.longitude,
  };
}

// ---- Public API -----------------------------------------------------

export type StartResult = {
  /** How many pins we actually registered (capped to iOS limit of 20). */
  registered: number;
  /** Pins skipped because we hit the cap (sorted by distance, farthest first). */
  skipped: number;
};

/** Start watching geofences for the given pins. Caps to 20 nearest. */
export async function startBackgroundGeofencing(
  pins: Pin[],
): Promise<StartResult> {
  // Foreground first; then background. iOS will pop "Always allow".
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    throw new Error('Location permission denied.');
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    throw new Error(
      'Background location not granted. Set Location → Always in Settings to play clips when the app is in the background.',
    );
  }

  // Pick the nearest 20 pins to where the user is right now.
  const here = await Location.getCurrentPositionAsync({});
  const sorted = [...pins].sort((a, b) => {
    const da = distanceMeters(
      here.coords.latitude,
      here.coords.longitude,
      a.latitude,
      a.longitude,
    );
    const db = distanceMeters(
      here.coords.latitude,
      here.coords.longitude,
      b.latitude,
      b.longitude,
    );
    return da - db;
  });
  const chosen = sorted.slice(0, 20);

  // Cache pin data so the background task can read it without auth.
  const cache: Record<string, CachedPin> = {};
  for (const p of chosen) cache[p.id] = toCached(p);
  await AsyncStorage.setItem(PIN_CACHE_KEY, JSON.stringify(cache));

  // Stop any old geofencing first so we don't double-register.
  if (await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME)) {
    try {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    } catch {
      // Ignore — may already be stopped.
    }
  }

  await Location.startGeofencingAsync(
    GEOFENCE_TASK_NAME,
    chosen.map((p) => ({
      identifier: p.id,
      latitude: p.latitude,
      longitude: p.longitude,
      radius: 50, // meters — matches the old foreground threshold
      notifyOnEnter: true,
      notifyOnExit: true,
    })),
  );

  return { registered: chosen.length, skipped: pins.length - chosen.length };
}

/** Stop watching geofences and clear the cache. Safe to call when not
 *  currently watching — no-ops if the task isn't registered. */
export async function stopBackgroundGeofencing(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME)) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    }
  } catch (e) {
    console.warn('[geofence] stop failed', e);
  }
  try {
    await AsyncStorage.removeItem(PIN_CACHE_KEY);
  } catch {
    // Ignore.
  }
}

/** True if we're currently watching geofences (survives reloads). */
export async function isBackgroundGeofencingActive(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
  } catch {
    return false;
  }
}
