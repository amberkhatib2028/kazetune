// Client wrappers for the friends RPCs.

import { supabase } from './supabase';

export type FriendshipStatus =
  | 'none'
  | 'pending_outgoing'
  | 'pending_incoming'
  | 'accepted';

export type UserSearchResult = {
  id: string;
  display_name: string | null;
  spotify_id: string | null;
  avatar_url: string | null;
  friendship_status: FriendshipStatus;
};

export type FriendSummary = {
  other_id: string;
  other_display_name: string | null;
  other_spotify_id: string | null;
  other_avatar_url: string | null;
  status: 'accepted' | 'pending_outgoing' | 'pending_incoming';
  created_at: string;
};

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase.rpc('search_users', {
    p_query: query.trim(),
  });
  if (error) throw error;
  return (data ?? []) as UserSearchResult[];
}

export async function listFriendSummary(): Promise<FriendSummary[]> {
  const { data, error } = await supabase.rpc('list_friend_summary');
  if (error) throw error;
  return (data ?? []) as FriendSummary[];
}

export async function sendFriendRequest(friendId: string): Promise<void> {
  const { error } = await supabase.rpc('send_friend_request', {
    p_friend_id: friendId,
  });
  if (error) throw error;
}

export async function acceptFriendRequest(fromUserId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_friend_request', {
    p_from_user_id: fromUserId,
  });
  if (error) throw error;
}

export async function removeFriend(otherId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_friend', {
    p_other_id: otherId,
  });
  if (error) throw error;
}
