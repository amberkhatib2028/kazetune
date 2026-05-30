// Image picking + uploading to Supabase Storage.
//
// One bucket (`kazetune-media`) with three folder prefixes:
//   pin/<user_id>/<random>.jpg
//   playlist/<user_id>/<random>.jpg
//   avatar/<user_id>.jpg
//
// The storage RLS policy enforces that the user can only write to their
// own <user_id> folder, so the prefix is a hard rule, not just a hint.
//
// Picking is done with expo-image-picker. Uploading reads the file URI
// into an ArrayBuffer (the recommended pattern for RN + Supabase) — the
// Blob path is unreliable on Hermes.

import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

const BUCKET = 'kazetune-media';

export type ImageKind = 'pin' | 'playlist' | 'avatar';

// ----- picking -------------------------------------------------------

/** Prompts the user to pick an image from their library. Returns the
 *  local file URI or null if they cancelled. Asks for permission first;
 *  shows nothing if they deny. */
export async function pickImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

// ----- uploading -----------------------------------------------------

/** Uploads a local file (from pickImage()) to Supabase Storage and
 *  returns the public URL. The path is determined by `kind`:
 *    pin/<uid>/<rand>.jpg, playlist/<uid>/<rand>.jpg, avatar/<uid>.jpg.
 *
 *  Avatars upsert (same path every time) so the user always has one
 *  current picture; pin/playlist images are uniquely named so each
 *  pin/playlist gets its own file. */
export async function uploadImage(
  kind: ImageKind,
  localUri: string,
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const ext = guessExt(localUri);
  // Every path has 3 segments — `<kind>/<user_id>/<filename>` — so the
  // storage RLS policy can check split_part(name, '/', 2) = auth.uid()
  // uniformly across pin, playlist, and avatar uploads.
  const path =
    kind === 'avatar'
      ? `avatar/${user.id}/avatar.${ext}`
      : `${kind}/${user.id}/${Date.now()}-${rand6()}.${ext}`;

  // RN + Supabase storage: pull the file as ArrayBuffer rather than Blob.
  const arrayBuffer = await fetch(localUri).then((r) => r.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: mimeFor(ext),
      upsert: kind === 'avatar',
    });
  if (error) throw error;

  // public bucket → public URL just works
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust avatars since we upsert the same path on every change.
  return kind === 'avatar' ? `${data.publicUrl}?t=${Date.now()}` : data.publicUrl;
}

// ----- helpers -------------------------------------------------------

function guessExt(uri: string): string {
  const m = uri.match(/\.([a-z0-9]+)(\?|$)/i);
  const ext = (m?.[1] ?? 'jpg').toLowerCase();
  // Normalize a few — Supabase doesn't care but it makes URLs prettier.
  return ext === 'jpeg' ? 'jpg' : ext;
}

function mimeFor(ext: string): string {
  switch (ext) {
    case 'png':  return 'image/png';
    case 'gif':  return 'image/gif';
    case 'webp': return 'image/webp';
    case 'heic': return 'image/heic';
    default:     return 'image/jpeg';
  }
}

function rand6(): string {
  return Math.random().toString(36).slice(2, 8);
}
