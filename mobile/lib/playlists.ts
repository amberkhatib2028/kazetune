// Client-side wrappers for the playlist RPCs.

import { supabase } from './supabase';

export type Playlist = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  is_mine: boolean;
  pin_count: number;
  created_at: string;
  cover_image_url: string | null;
  owner_display_name: string | null;
  owner_avatar_url: string | null;
};

export type PlaylistPin = {
  id: string;
  pos: number;
  latitude: number;
  longitude: number;
  place_name: string | null;
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  start_seconds: number;
  duration_seconds: number;
  is_public: boolean;
  is_mine: boolean;
  preview_url: string | null;
  album_image_url: string | null;
  image_url: string | null;
  description: string | null;
};

export async function listPlaylists(): Promise<Playlist[]> {
  const { data, error } = await supabase.rpc('list_playlists');
  if (error) throw error;
  return (data ?? []) as Playlist[];
}

export async function createPlaylist(opts: {
  title: string;
  description?: string | null;
  isPublic?: boolean;
  coverImageUrl?: string | null;
}): Promise<Playlist> {
  const { data, error } = await supabase.rpc('create_playlist', {
    p_title: opts.title,
    p_description: opts.description ?? null,
    p_is_public: opts.isPublic ?? false,
    p_cover_image_url: opts.coverImageUrl ?? null,
  });
  if (error) throw error;
  return data as Playlist;
}

export async function addPinToPlaylist(
  playlistId: string,
  pinId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('add_pin_to_playlist', {
    p_playlist_id: playlistId,
    p_pin_id: pinId,
  });
  if (error) throw error;
  return data as number;
}

export async function removePinFromPlaylist(
  playlistId: string,
  pinId: string,
): Promise<void> {
  const { error } = await supabase.rpc('remove_pin_from_playlist', {
    p_playlist_id: playlistId,
    p_pin_id: pinId,
  });
  if (error) throw error;
}

export async function listPlaylistPins(playlistId: string): Promise<PlaylistPin[]> {
  const { data, error } = await supabase.rpc('list_playlist_pins', {
    p_playlist_id: playlistId,
  });
  if (error) throw error;
  return (data ?? []) as PlaylistPin[];
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  const { error } = await supabase.from('playlists').delete().eq('id', playlistId);
  if (error) throw error;
}
