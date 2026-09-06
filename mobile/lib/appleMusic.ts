// Apple Music catalog search — replaces lib/spotify.ts. Wraps
// @lomray/react-native-apple-music's MusicKit.catalogSearch and
// normalizes results into the shape the app already uses for a track.
//
// Requires: MusicKit enabled on the App ID, NSAppleMusicUsageDescription,
// iOS 16+ (for catalog search), and the user authorized + subscribed.

import { CatalogSearchType, MusicKit, type ISong } from '@lomray/react-native-apple-music';

export type AppleTrack = {
  id: string; // Apple Music catalog song ID
  name: string;
  artist: string;
  artworkUrl: string | null;
  durationSec: number;
};

// Apple artwork URLs embed {w}x{h} placeholders — fill them for a real URL.
function artwork(url: string | undefined, size = 400): string | null {
  if (!url) return null;
  return url.replace('{w}', String(size)).replace('{h}', String(size));
}

// song.duration comes across from the native side as a string of seconds.
function durationToSec(d: unknown): number {
  const n = typeof d === 'number' ? d : Number(d);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function toTrack(s: ISong): AppleTrack {
  return {
    id: s.id,
    name: s.title,
    artist: s.artistName,
    artworkUrl: artwork(s.artworkUrl),
    durationSec: durationToSec(s.duration),
  };
}

export async function searchTracks(query: string): Promise<AppleTrack[]> {
  if (!query.trim()) return [];
  const res = await MusicKit.catalogSearch(query.trim(), [CatalogSearchType.SONGS], {
    limit: 25,
  });
  return (res?.songs ?? []).map(toTrack);
}

/** Fetch one song's duration (Apple returns it on search, but edit-pin
 *  needs it standalone). We re-search by ID isn't supported, so callers
 *  should pass the duration they already have; kept for parity. */
export function appleMusicTrackUrl(id: string): string {
  return `https://music.apple.com/song/${id}`;
}
