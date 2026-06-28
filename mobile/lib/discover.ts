// Discover: public pins + playlists from people you're NOT friends with
// (strangers), so there's something to explore beyond your own circle.
//
// No new backend — public content is already readable under RLS (and
// blocked users are filtered there too). We just fetch everything you
// can see and keep the public, not-mine, not-from-a-friend slice.

import { listFriendSummary } from './friends';
import { listPins, type Pin } from './pins';
import { listPlaylists, type Playlist } from './playlists';

export type DiscoverData = {
  pins: Pin[];
  playlists: Playlist[];
};

export async function listDiscover(): Promise<DiscoverData> {
  const [pins, playlists, friends] = await Promise.all([
    listPins(),
    listPlaylists(),
    listFriendSummary().catch(() => []),
  ]);

  const friendIds = new Set(
    friends.filter((f) => f.status === 'accepted').map((f) => f.other_id),
  );

  const discPins = pins.filter(
    (p) => p.is_public && !p.is_mine && !!p.user_id && !friendIds.has(p.user_id),
  );
  const discPlaylists = playlists.filter(
    (pl) =>
      pl.is_public && !pl.is_mine && !pl.is_saved && !friendIds.has(pl.user_id),
  );

  return { pins: discPins, playlists: discPlaylists };
}
