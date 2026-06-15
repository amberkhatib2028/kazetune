// Full-track playback via the Spotify Web API "Connect" controls.
//
// kazetune ties a *specific moment* of a song to a place — a start
// offset and a duration. Provider preview clips (Spotify's old
// preview_url, iTunes, etc.) are fixed ~30s segments chosen by the
// provider, so they can't honor an arbitrary start point. The only way
// to play "the song from 1:45 for 25 seconds" is real full-track
// playback, which Spotify exposes (Premium only) through these REST
// endpoints:
//
//   PUT /me/player/play   { uris, position_ms }   start a track at a point
//   PUT /me/player/pause                          stop
//   GET /me/player/devices                        list Connect devices
//   PUT /me/player        { device_ids, play }    transfer/activate a device
//
// Caveat: these CONTROL an active Spotify Connect device; they don't
// emit audio themselves. The user's Spotify app (or a speaker) must be
// an available device. If none is active we try to transfer playback to
// the first available one; if there are none, we surface NO_DEVICE so
// the UI can tell the user to open Spotify.

import { getSpotifyTokens, refreshSpotifyToken } from './supabase';
import type { Pin } from './pins';

const SPOTIFY_API = 'https://api.spotify.com/v1';

// Distinct, machine-readable failure reasons so callers can show the
// right guidance instead of a raw HTTP error.
export type PlaybackErrorReason =
  | 'NO_TOKEN' // not signed in with Spotify / token missing
  | 'EXPIRED' // token expired (needs refresh — see lib/supabase token TODO)
  | 'PREMIUM_REQUIRED' // Spotify free account can't be remote-controlled
  | 'NO_DEVICE' // no active/available Spotify device to play on
  | 'UNKNOWN';

export class PlaybackError extends Error {
  reason: PlaybackErrorReason;
  constructor(reason: PlaybackErrorReason, message: string) {
    super(message);
    this.name = 'PlaybackError';
    this.reason = reason;
  }
}

// Track which pin is "playing" and the timer that pauses it once the
// pin's clip duration elapses, so a new pin cleanly supersedes the old.
let currentPinId: string | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

async function accessToken(): Promise<string> {
  const tokens = await getSpotifyTokens();
  if (!tokens?.provider_token) {
    throw new PlaybackError(
      'NO_TOKEN',
      'No Spotify session. Sign out and sign in with Spotify again.',
    );
  }
  return tokens.provider_token;
}

// Thin wrapper that maps Spotify's status codes to PlaybackError. The
// player endpoints return 204 No Content on success and have no body.
function rawPlayerFetch(
  path: string,
  init: { method: string; body?: any },
  token: string,
): Promise<Response> {
  return fetch(`${SPOTIFY_API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
}

async function playerFetch(
  path: string,
  init: { method: string; body?: any } = { method: 'GET' },
): Promise<any> {
  const token = await accessToken();
  let res = await rawPlayerFetch(path, init, token);

  // Token expired — refresh once via the Edge Function and retry.
  if (res.status === 401) {
    const fresh = await refreshSpotifyToken();
    if (fresh) res = await rawPlayerFetch(path, init, fresh);
  }

  if (res.status === 401) {
    throw new PlaybackError('EXPIRED', 'Spotify session expired. Sign in again.');
  }
  if (res.status === 403) {
    throw new PlaybackError(
      'PREMIUM_REQUIRED',
      'Full-track playback requires Spotify Premium.',
    );
  }
  if (res.status === 404) {
    // The player endpoints 404 with reason NO_ACTIVE_DEVICE when there's
    // nothing to control.
    throw new PlaybackError('NO_DEVICE', 'No active Spotify device.');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new PlaybackError('UNKNOWN', `Spotify request failed (${res.status}): ${body}`);
  }
  // 204 (and most player calls) have no JSON body.
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

type Device = { id: string; is_active: boolean; type: string; name: string };

async function listDevices(): Promise<Device[]> {
  const data = await playerFetch('/me/player/devices');
  return (data?.devices ?? []) as Device[];
}

// Ensure there's an active device to play on. If one is already active,
// great. Otherwise transfer playback to the first available device
// (typically the phone's own Spotify app). Throws NO_DEVICE if there are
// none — the caller tells the user to open Spotify.
async function ensureActiveDevice(): Promise<void> {
  const devices = await listDevices();
  if (devices.some((d) => d.is_active)) return;
  if (devices.length === 0) {
    throw new PlaybackError(
      'NO_DEVICE',
      'Open Spotify on your phone (play and pause anything once), then try again.',
    );
  }
  // Prefer a smartphone if present, else just take the first.
  const target =
    devices.find((d) => d.type.toLowerCase() === 'smartphone') ?? devices[0];
  await playerFetch('/me/player', {
    method: 'PUT',
    body: { device_ids: [target.id], play: false },
  });
}

// Shared core: stop whatever's playing, ensure a device, play the given
// track seeked to startSeconds, and arm the auto-pause timer.
async function startSegment(
  trackId: string,
  startSeconds: number,
  durationSeconds: number,
  clipId: string,
): Promise<boolean> {
  await stopPinClip();
  await ensureActiveDevice();

  await playerFetch('/me/player/play', {
    method: 'PUT',
    body: {
      uris: [`spotify:track:${trackId}`],
      position_ms: Math.max(0, startSeconds) * 1000,
    },
  });

  currentPinId = clipId;

  // Auto-pause once the clip window elapses. A subsequent play/stop
  // clears this timer first, so only the active clip stops.
  if (durationSeconds > 0) {
    stopTimer = setTimeout(() => {
      stopPinClip().catch(() => {});
    }, durationSeconds * 1000);
  }
  return true;
}

/**
 * Play a pin's clip: the full Spotify track, seeked to the pin's
 * start_seconds, auto-paused after duration_seconds. Returns true on
 * success. Throws PlaybackError with a reason on failure so the UI can
 * guide the user (no device, not Premium, expired session, …).
 */
export async function playPinClip(pin: Pin): Promise<boolean> {
  if (currentPinId === pin.id) return true;
  return startSegment(
    pin.spotify_track_id,
    pin.start_seconds,
    pin.duration_seconds,
    pin.id,
  );
}

/**
 * Preview an arbitrary segment of a track while the user is picking the
 * clip (the create/edit clip slider). Always re-seeks, so repeated calls
 * as the user drags to new start points work. Same PlaybackError
 * semantics as playPinClip.
 */
export async function playTrackSegment(
  trackId: string,
  startSeconds: number,
  durationSeconds: number,
): Promise<boolean> {
  return startSegment(trackId, startSeconds, durationSeconds, `preview:${trackId}`);
}

export async function stopPinClip(): Promise<void> {
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (currentPinId === null) return;
  currentPinId = null;
  try {
    await playerFetch('/me/player/pause', { method: 'PUT' });
  } catch (e) {
    // Pausing can 404 if the device went away or 403 on edge cases —
    // we've already cleared our state, so swallow it.
  }
}

export function getCurrentPinId(): string | null {
  return currentPinId;
}
