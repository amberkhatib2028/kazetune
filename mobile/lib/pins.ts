// Pin queries — wraps the Supabase RPCs.

import { supabase } from './supabase';

export type PinVisibility = 'private' | 'friends' | 'public';

export type Pin = {
  id: string;
  // Optional because PlaylistPin (which extends Pin structurally) and
  // older RPC responses don't include it. Treat absence as "not the
  // user's friend" for filtering purposes.
  user_id?: string;
  latitude: number;
  longitude: number;
  place_name: string | null;
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  start_seconds: number;
  duration_seconds: number;
  is_public: boolean;
  visibility: PinVisibility;
  is_mine: boolean;
  preview_url: string | null;
  album_image_url: string | null;
  image_url: string | null;
  /** Free-text note — the "why" behind the pin. */
  description: string | null;
};

export async function listPins(): Promise<Pin[]> {
  const { data, error } = await supabase.rpc('list_pins');
  if (error) throw error;
  return (data ?? []) as Pin[];
}

/** Update an existing pin. Only the owner can edit; RLS enforces it.
 *  Pass imageUrl='' (or null) to clear the user-uploaded photo. */
export async function updatePin(opts: {
  pinId: string;
  latitude: number;
  longitude: number;
  placeName: string;
  startSeconds: number;
  durationSeconds: number;
  visibility: PinVisibility;
  /** Empty string or null to clear; otherwise the new public URL. */
  imageUrl: string | null;
  /** Free-text note; '' clears it. */
  description: string;
}): Promise<void> {
  const { error } = await supabase.rpc('update_pin', {
    p_pin_id: opts.pinId,
    p_latitude: opts.latitude,
    p_longitude: opts.longitude,
    p_place_name: opts.placeName,
    p_start_seconds: opts.startSeconds,
    p_duration_seconds: opts.durationSeconds,
    p_visibility: opts.visibility,
    p_image_url: opts.imageUrl ?? '',
    p_description: opts.description,
  });
  if (error) throw error;
}
