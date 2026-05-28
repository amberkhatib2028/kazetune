// Shared "walking mode" state hook.
//
// Wires the geofencing watcher + audio playback together. Used by both
// the global Map tab (walks all visible pins) and the playlist detail
// screen (walks only that playlist's pins). The caller just passes in
// the pin set.

import { useCallback, useEffect, useRef, useState } from 'react';

import { playPinClip, stopPinClip } from './audio';
import { startWalking, type WalkingHandle } from './geofencing';
import type { Pin } from './pins';

export function useWalkingMode(pins: Pin[]) {
  const [walking, setWalking] = useState(false);
  const handleRef = useRef<WalkingHandle | null>(null);
  const [nowPlaying, setNowPlaying] = useState<Pin | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Stop walking + audio when the consumer unmounts.
  useEffect(() => () => {
    handleRef.current?.stop();
    handleRef.current = null;
    stopPinClip();
  }, []);

  const toggle = useCallback(async () => {
    if (walking) {
      handleRef.current?.stop();
      handleRef.current = null;
      await stopPinClip();
      setWalking(false);
      setNowPlaying(null);
      setMessage(null);
      return;
    }
    if (pins.length === 0) {
      setMessage('No pins to walk to.');
      return;
    }
    try {
      setMessage(null);
      const handle = await startWalking({
        pins,
        onEnter: async (pin) => {
          const ok = await playPinClip(pin);
          setNowPlaying(ok ? pin : null);
          setMessage(ok ? null : `No preview audio for "${pin.track_name}"`);
        },
        onExit: (pin) => {
          setNowPlaying((cur) => (cur?.id === pin.id ? null : cur));
        },
        onError: (msg) => setMessage(msg),
      });
      handleRef.current = handle;
      setWalking(true);
    } catch (e: any) {
      setMessage(e?.message ?? String(e));
    }
  }, [walking, pins]);

  return { walking, nowPlaying, message, toggle };
}
