// Account actions: sign out, edit display name, delete account.

import { clearSpotifyTokens, supabase } from './supabase';

/** Sign out of Supabase and clear the stored Spotify tokens so the next
 *  user doesn't inherit them. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await clearSpotifyTokens();
}

/** Update the current user's display name. RLS allows a user to update
 *  only their own profile row. */
export async function updateDisplayName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Display name cannot be empty.');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', user.id);
  if (error) throw error;
}

/** Permanently delete the user's account and all their data, then sign
 *  out locally. Irreversible — gate this behind a strong confirmation. */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_account');
  if (error) throw error;
  // The auth row is gone; clear the local session + tokens too.
  await supabase.auth.signOut();
  await clearSpotifyTokens();
}
