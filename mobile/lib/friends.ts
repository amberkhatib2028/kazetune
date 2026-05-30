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
  username: string | null;
  spotify_id: string | null;
  avatar_url: string | null;
  friendship_status: FriendshipStatus;
};

export type UserLookupResult = {
  id: string;
  username: string | null;
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

// --- Username helpers -----------------------------------------------

/** Claim or change the user's @handle. Server validates format +
 *  enforces uniqueness; throws a friendly error if taken. */
export async function setUsername(username: string): Promise<void> {
  const { error } = await supabase.rpc('set_username', {
    p_username: username,
  });
  if (error) throw error;
}

/** Resolve a username (with or without leading @) to a profile.
 *  Returns null if no such user exists. */
export async function lookupUserByUsername(
  username: string,
): Promise<UserLookupResult | null> {
  const cleaned = username.trim().replace(/^@/, '');
  if (!cleaned) return null;
  const { data, error } = await supabase.rpc('lookup_user_by_username', {
    p_username: cleaned,
  });
  if (error) throw error;
  const rows = (data ?? []) as UserLookupResult[];
  return rows[0] ?? null;
}

// --- Friend activity feed --------------------------------------------

export type FriendActivityItem = {
  kind: 'pin' | 'playlist';
  id: string;
  created_at: string;
  title: string;
  subtitle: string | null;
  place_name: string | null;
  image_url: string | null;
  friend_id: string;
  friend_display_name: string | null;
  friend_avatar_url: string | null;
};

/** Recent public pins + playlists from accepted friends, newest first.
 *  Capped at 50 items by the RPC. */
export async function listFriendActivity(): Promise<FriendActivityItem[]> {
  const { data, error } = await supabase.rpc('list_friend_activity');
  if (error) throw error;
  return (data ?? []) as FriendActivityItem[];
}
