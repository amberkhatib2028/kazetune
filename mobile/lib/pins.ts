// Pin queries — wraps the Supabase RPCs.

import { supabase } from './supabase';

export type Pin = {
  id: string;
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
};

export async function listPins(): Promise<Pin[]> {
  const { data, error } = await supabase.rpc('list_pins');
  if (error) throw error;
  return (data ?? []) as Pin[];
}
