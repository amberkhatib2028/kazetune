// Shared "walking mode" state hook.
//
// Backed by background geofencing (lib/backgroundGeofencing.ts) so
// clips also play when the app is in the user's pocket / screen off.
// The task itself plays the audio; this hook just mirrors the
// now-playing state via DeviceEventEmitter so the UI can show what's
// playing while the app is open.
//
// Also records the walk so we can pop a post-walk summary modal on
// Stop:
//   - path: a stream of {lat, lng, t} sampled by Location.watchPositionAsync
//           while the app is in the foreground. We accept that the
//           path may have gaps if the user backgrounds the app —
//           geofence-collected pins still get captured either way.
//   - collectedPins: every pin whose geofence fired during this walk
//           (deduped by id).

import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import * as Location from 'expo-location';

import { stopPinClip } from './audio';
import {
  GEOFENCE_EVENT_ENTER,
  GEOFENCE_EVENT_EXIT,
  isBackgroundGeofencingActive,
  startBackgroundGeofencing,
  stopBackgroundGeofencing,
} from './backgroundGeofencing';
import type { Pin } from './pins';
import {
  setLastWalk,
  type PathPoint,
  type WalkRecord,
} from './walkRecorder';

export function useWalkingMode(pins: Pin[]) {
  const [walking, setWalking] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<Pin | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Path + collected-pin recording. Stored in refs (not state) because
  // they don't drive UI here — we just hand them off on Stop.
  const pathRef = useRef<PathPoint[]>([]);
  const collectedRef = useRef<Pin[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const watchSubRef = useRef<Location.LocationSubscription | null>(null);
  // Avoid double-fires of the hook re-syncing state while a toggle is
  // mid-flight.
  const toggling = useRef(false);

  // On mount: ask the OS whether we're already in the middle of a walk
  // (e.g. the user backgrounded the app and is reopening it). This way
  // the button reflects reality after a relaunch.
  useEffect(() => {
    let mounted = true;
    isBackgroundGeofencingActive().then((active) => {
      if (mounted) setWalking(active);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to enter/exit events from the geofence task. These fire
  // while the app is foregrounded; in background the task plays audio
  // directly without our React layer hearing about it.
  useEffect(() => {
    const enterSub = DeviceEventEmitter.addListener(
      GEOFENCE_EVENT_ENTER,
      (pin: Pin) => {
        setNowPlaying(pin);
        setMessage(
          pin.preview_url ? null : `No preview audio for "${pin.track_name}"`,
        );
        // Add to collected list (deduped by id).
        if (!collectedRef.current.some((p) => p.id === pin.id)) {
          collectedRef.current = [...collectedRef.current, pin];
        }
      },
    );
    const exitSub = DeviceEventEmitter.addListener(
      GEOFENCE_EVENT_EXIT,
      (pin: Pin) => {
        setNowPlaying((cur) => (cur?.id === pin.id ? null : cur));
      },
    );
    return () => {
      enterSub.remove();
      exitSub.remove();
    };
  }, []);

  // Tear down the foreground location watch on unmount (e.g. user
  // navigates away mid-walk and the consumer hook goes away).
  useEffect(() => () => {
    watchSubRef.current?.remove();
    watchSubRef.current = null;
  }, []);

  const toggle = useCallback(async () => {
    if (toggling.current) return;
    toggling.current = true;
    try {
      if (walking) {
        // ---- Stop ---------------------------------------------------
        await stopBackgroundGeofencing();
        await stopPinClip();
        watchSubRef.current?.remove();
        watchSubRef.current = null;

        const record: WalkRecord = {
          startedAt: startedAtRef.current ?? Date.now(),
          endedAt: Date.now(),
          path: pathRef.current,
          collectedPins: collectedRef.current,
        };
        setLastWalk(record);

        setWalking(false);
        setNowPlaying(null);
        setMessage(null);

        // Only pop the summary if we actually recorded something — no
        // point showing an empty modal if they tapped Start then Stop
        // immediately.
        if (record.path.length > 0 || record.collectedPins.length > 0) {
          // Cast: expo-router auto-generates the typed-route table the
          // first time Metro restarts after adding a new file, so this
          // string isn't in the union yet from a cold typecheck.
          router.push('/walk-summary' as never);
        }

        // Reset for the next walk.
        pathRef.current = [];
        collectedRef.current = [];
        startedAtRef.current = null;
        return;
      }

      // ---- Start ---------------------------------------------------
      if (pins.length === 0) {
        setMessage('No pins to walk to.');
        return;
      }
      setMessage(null);
      const result = await startBackgroundGeofencing(pins);

      // Reset record state and start foreground location sampling.
      pathRef.current = [];
      collectedRef.current = [];
      startedAtRef.current = Date.now();
      watchSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          // Sample at most every 5m of movement or every 5s while idle,
          // whichever comes first — keeps the path detailed without
          // chewing battery.
          distanceInterval: 5,
          timeInterval: 5000,
        },
        (loc) => {
          pathRef.current = [
            ...pathRef.current,
            {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              t: Date.now(),
            },
          ];
        },
      );

      setWalking(true);
      if (result.skipped > 0) {
        setMessage(
          `Watching the ${result.registered} nearest pins (iOS caps at 20; skipped ${result.skipped}).`,
        );
      } else {
        setMessage(
          `Watching ${result.registered} pin${result.registered === 1 ? '' : 's'}.`,
        );
      }
    } catch (e: any) {
      setMessage(e?.message ?? String(e));
      setWalking(false);
    } finally {
      toggling.current = false;
    }
  }, [walking, pins]);

  return { walking, nowPlaying, message, toggle };
}
