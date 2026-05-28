// Foreground-only "walking mode" — watches the device location and
// fires onEnter / onExit callbacks as the user crosses ~50m circles
// around each pin.
//
// We don't use expo-location's native startGeofencingAsync yet because
// (a) it requires background permissions and TaskManager setup,
// (b) it caps at ~20 regions on iOS, and (c) we want the same logic
// to work on web. watchPositionAsync runs in JS on every platform.

import * as Location from 'expo-location';

import type { Pin } from './pins';

const RADIUS_METERS = 50;       // enter at <= 50m
const EXIT_RADIUS_METERS = 75;  // exit at >= 75m (hysteresis to stop flapping)

/** Haversine distance in meters between two lat/lng pairs. */
function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // earth radius, meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type WalkingHandle = {
  stop: () => void;
};

export async function startWalking(opts: {
  pins: Pin[];
  onEnter: (pin: Pin) => void;
  onExit?: (pin: Pin) => void;
  onError?: (msg: string) => void;
}): Promise<WalkingHandle> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied.');
  }

  const insidePinIds = new Set<string>();

  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 5, // recheck every 5m of movement
      timeInterval: 2000,  // Android: also recheck every 2s while idle
    },
    (loc) => {
      const { latitude, longitude } = loc.coords;
      for (const pin of opts.pins) {
        const dist = distanceMeters(
          latitude,
          longitude,
          pin.latitude,
          pin.longitude,
        );
        const wasInside = insidePinIds.has(pin.id);
        if (!wasInside && dist <= RADIUS_METERS) {
          insidePinIds.add(pin.id);
          opts.onEnter(pin);
        } else if (wasInside && dist >= EXIT_RADIUS_METERS) {
          insidePinIds.delete(pin.id);
          opts.onExit?.(pin);
        }
      }
    },
    (err) => opts.onError?.(err),
  );

  return {
    stop: () => subscription.remove(),
  };
}
