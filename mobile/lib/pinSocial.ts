// Pin social: likes + comments. Thin client over the RPCs in
// pin_social_migration.sql. Visibility + blocking + reporting are all
// enforced in the database, so this layer just calls and maps.

import { supabase } from './supabase';

export type PinComment = {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  body: string;
  created_at: string;
  is_mine: boolean;
};

export type PinLikeSummary = {
  like_count: number;
  liked_by_me: boolean;
};

export async function likePin(pinId: string): Promise<void> {
  const { error } = await supabase.rpc('like_pin', { p_pin_id: pinId });
  if (error) throw error;
}

export async function unlikePin(pinId: string): Promise<void> {
  const { error } = await supabase.rpc('unlike_pin', { p_pin_id: pinId });
  if (error) throw error;
}

export async function getPinLikeSummary(pinId: string): Promise<PinLikeSummary> {
  const { data, error } = await supabase.rpc('pin_like_summary', {
    p_pin_id: pinId,
  });
  if (error) throw error;
  // RPC returns a single-row table.
  const row = Array.isArray(data) ? data[0] : data;
  return {
    like_count: row?.like_count ?? 0,
    liked_by_me: row?.liked_by_me ?? false,
  };
}

export async function listPinComments(pinId: string): Promise<PinComment[]> {
  const { data, error } = await supabase.rpc('list_pin_comments', {
    p_pin_id: pinId,
  });
  if (error) throw error;
  return (data ?? []) as PinComment[];
}

export async function addPinComment(
  pinId: string,
  body: string,
): Promise<void> {
  const { error } = await supabase.rpc('add_pin_comment', {
    p_pin_id: pinId,
    p_body: body,
  });
  if (error) throw error;
}

export async function deletePinComment(commentId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_pin_comment', {
    p_comment_id: commentId,
  });
  if (error) throw error;
}
