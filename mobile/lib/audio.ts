// Imperative audio playback for kazetune.
//
// One AudioPlayer at a time. Starting a new pin's clip stops the
// previous one. Designed to be called from outside React components
// (e.g. a geofence callback), so we use `createAudioPlayer` rather
// than the `useAudioPlayer` hook.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import type { Pin } from './pins';

let currentPlayer: AudioPlayer | null = null;
let currentPinId: string | null = null;
let audioModeReady = false;

async function ensureAudioMode() {
  if (audioModeReady) return;
  try {
    // iOS:
    //   playsInSilentMode      — play even if the ringer switch is off
    //   shouldPlayInBackground — keep the audio session alive when the
    //                             app is backgrounded or the screen is
    //                             locked (paired with the
    //                             enableBackgroundPlayback flag in
    //                             app.json's expo-audio plugin config)
    //   interruptionMode 'doNotMix' — kazetune is the focused audio
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  } catch {
    // No-op on web / older iOS.
  }
  audioModeReady = true;
}

/**
 * Play the 30-second Spotify preview attached to a pin.
 * Returns false if the pin has no preview_url (Spotify dropped previews
 * for many tracks in 2024+; we just shrug and move on).
 */
export async function playPinClip(pin: Pin): Promise<boolean> {
  if (currentPinId === pin.id) return true;
  await stopPinClip();
  if (!pin.preview_url) return false;

  await ensureAudioMode();

  const player = createAudioPlayer(pin.preview_url);
  // Surface the track on the iOS lock screen / Android media notification
  // so background playback is identifiable. setActiveForLockScreen is
  // documented in expo-audio (SDK 55); silently ignored on web.
  try {
    (player as any).setActiveForLockScreen?.(true, {
      title: pin.track_name,
      artist: pin.artist_name,
    });
  } catch {
    // No-op.
  }
  player.play();
  currentPlayer = player;
  currentPinId = pin.id;
  return true;
}

export async function stopPinClip(): Promise<void> {
  if (currentPlayer) {
    try {
      currentPlayer.pause();
      currentPlayer.remove();
    } catch {
      // Already disposed; ignore.
    }
    currentPlayer = null;
    currentPinId = null;
  }
}

export function getCurrentPinId(): string | null {
  return currentPinId;
}
