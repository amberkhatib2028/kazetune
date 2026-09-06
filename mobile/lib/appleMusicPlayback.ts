// Apple Music playback — replaces lib/spotifyPlayback.ts.
//
// Plays a full catalog track through the user's Apple Music, seeked to the
// pin's start and auto-paused after the clip's duration. Unlike Spotify's
// Connect API there's no "active device" dance — MusicKit plays on this
// device directly. Requires an Apple Music subscription.

import { Auth, AuthStatus, MusicKit, MusicItem, Player } from '@lomray/react-native-apple-music';

export type PlaybackErrorReason =
  | 'NOT_AUTHORIZED' // user hasn't granted Apple Music access
  | 'NO_SUBSCRIPTION' // no active Apple Music subscription
  | 'UNKNOWN';

export class PlaybackError extends Error {
  reason: PlaybackErrorReason;
  constructor(reason: PlaybackErrorReason, message: string) {
    super(message);
    this.name = 'PlaybackError';
    this.reason = reason;
  }
}

// Which clip is playing + the timer that pauses it when the window elapses.
let currentClipId: string | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

/** Ask for Apple Music access + confirm a subscription that can play the
 *  catalog. Throws PlaybackError with a reason the UI can act on. */
export async function ensureAppleMusicReady(): Promise<void> {
  let status: AuthStatus;
  try {
    status = await Auth.authorize();
  } catch {
    throw new PlaybackError('NOT_AUTHORIZED', 'Could not reach Apple Music.');
  }
  if (status !== AuthStatus.AUTHORIZED) {
    throw new PlaybackError(
      'NOT_AUTHORIZED',
      'Allow KazeTune to use Apple Music to play songs (Settings → KazeTune).',
    );
  }
  try {
    const sub = await Auth.checkSubscription();
    if (!sub.canPlayCatalogContent) {
      throw new PlaybackError(
        'NO_SUBSCRIPTION',
        'An Apple Music subscription is required to play full songs.',
      );
    }
  } catch (e) {
    if (e instanceof PlaybackError) throw e;
    throw new PlaybackError('NO_SUBSCRIPTION', 'Could not verify your Apple Music subscription.');
  }
}

async function startSegment(
  appleMusicId: string,
  startSeconds: number,
  durationSeconds: number,
  clipId: string,
): Promise<boolean> {
  await stopClip();
  await ensureAppleMusicReady();

  await MusicKit.setPlaybackQueue(appleMusicId, MusicItem.SONG);
  Player.play();
  // Seek shortly after playback starts — seeking before the queue is
  // actually playing is a no-op on iOS.
  setTimeout(() => {
    try {
      Player.seekToTime(Math.max(0, startSeconds));
    } catch {
      // ignore — playback still runs from the start
    }
  }, 350);

  currentClipId = clipId;
  if (durationSeconds > 0) {
    stopTimer = setTimeout(() => {
      stopClip().catch(() => {});
    }, (durationSeconds + 0.35) * 1000);
  }
  return true;
}

/** Play a pin's clip: the Apple Music track seeked to start_seconds,
 *  auto-paused after duration_seconds. */
export async function playPinClip(pin: {
  id: string;
  apple_music_id: string;
  start_seconds: number;
  duration_seconds: number;
}): Promise<boolean> {
  if (currentClipId === pin.id) return true;
  return startSegment(pin.apple_music_id, pin.start_seconds, pin.duration_seconds, pin.id);
}

/** Preview an arbitrary segment while picking the clip (create/edit). */
export async function playTrackSegment(
  appleMusicId: string,
  startSeconds: number,
  durationSeconds: number,
): Promise<boolean> {
  return startSegment(appleMusicId, startSeconds, durationSeconds, `preview:${appleMusicId}`);
}

export async function stopClip(): Promise<void> {
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (currentClipId === null) return;
  currentClipId = null;
  try {
    Player.pause();
  } catch {
    // already stopped / nothing playing
  }
}

// Alias to match the old Spotify call sites during the migration.
export const stopPinClip = stopClip;

export function getCurrentClipId(): string | null {
  return currentClipId;
}
