// Thin wrapper around Spotify Web API.
// Uses the provider_token Supabase saved during the OAuth login.

import { getSpotifyTokens, refreshSpotifyToken } from './supabase';

const SPOTIFY_API = 'https://api.spotify.com/v1';

export type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  duration_ms: number;
  preview_url: string | null;
};

async function getAccessToken(): Promise<string> {
  const tokens = await getSpotifyTokens();
  if (!tokens?.provider_token) {
    throw new Error(
      'No Spotify access token found. Sign out and sign in with Spotify again.'
    );
  }
  return tokens.provider_token;
}

async function spotifyFetch(path: string): Promise<any> {
  const token = await getAccessToken();
  let res = await fetch(`${SPOTIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Token expired — refresh once via the Edge Function and retry.
  if (res.status === 401) {
    const fresh = await refreshSpotifyToken();
    if (fresh) {
      res = await fetch(`${SPOTIFY_API}${path}`, {
        headers: { Authorization: `Bearer ${fresh}` },
      });
    }
  }

  if (res.status === 401) {
    throw new Error('Spotify session expired. Sign out and sign in again.');
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Spotify request failed (${res.status}): ${body}`);
  }
  return res.json();
}

/** Fetch one track's metadata — used to recover the full track length
 *  when editing a pin (pins don't store duration_ms). */
export async function getTrack(id: string): Promise<SpotifyTrack> {
  return (await spotifyFetch(`/tracks/${id}`)) as SpotifyTrack;
}

export async function searchTracks(query: string): Promise<SpotifyTrack[]> {
  if (!query.trim()) return [];
  // Omitting `limit` — Spotify defaults to 20. We had a "Invalid limit"
  // 400 even with limit=20, so just take the default for now.
  const path = `/search?q=${encodeURIComponent(query.trim())}&type=track`;
  console.log('[spotify] GET', path);
  const data = await spotifyFetch(path);
  return data.tracks?.items ?? [];
}
