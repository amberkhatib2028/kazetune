// Public user profile — reached by tapping someone in Friends, search
// results, the feed, or a pin's owner. Shows their avatar, handle, a
// friend button, and the pins/playlists you're allowed to see (RLS
// already filters to public + friends-only-if-friends). Shareable via a
// kazetune://user/<id> deep link.

import * as Linking from 'expo-linking';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View as RNView,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Text, View, useThemeColors } from '@/components/Themed';
import {
  acceptFriendRequest,
  listFriendSummary,
  removeFriend,
  sendFriendRequest,
  type FriendshipStatus,
} from '@/lib/friends';
import {
  blockUser,
  listBlockedUsers,
  promptReport,
  unblockUser,
} from '@/lib/moderation';
import { useNotifications } from '@/lib/notifications';
import { listPins, type Pin } from '@/lib/pins';
import { listPlaylists, type Playlist } from '@/lib/playlists';
import { supabase } from '@/lib/supabase';
import { Alert } from 'react-native';

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function UserProfileScreen() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh: refreshBadge } = useNotifications();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<FriendshipStatus>('none');
  const [isMe, setIsMe] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const load = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsMe(user?.id === id);

      const [{ data: prof }, summary, allPins, allPlaylists, blockedList] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .eq('id', id)
            .single(),
          listFriendSummary().catch(() => []),
          listPins().catch(() => []),
          listPlaylists().catch(() => []),
          listBlockedUsers().catch(() => []),
        ]);

      setProfile((prof as Profile) ?? null);
      const fr = summary.find((s) => s.other_id === id);
      setStatus(fr ? fr.status : 'none');
      setPins(allPins.filter((p) => p.user_id === id));
      setPlaylists(allPlaylists.filter((pl) => pl.user_id === id));
      setBlocked(blockedList.some((b) => b.id === id));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onFriendAction = async () => {
    try {
      setBusy(true);
      if (status === 'none') {
        await sendFriendRequest(id);
        setStatus('pending_outgoing');
      } else if (status === 'pending_incoming') {
        await acceptFriendRequest(id);
        setStatus('accepted');
      } else {
        await removeFriend(id);
        setStatus('none');
      }
      refreshBadge();
    } catch (e: any) {
      // Surfaced minimally; friends tab has full error UX.
    } finally {
      setBusy(false);
    }
  };

  const onShare = async () => {
    if (!profile) return;
    const url = Linking.createURL(`/user/${id}`);
    const who = profile.username ? `@${profile.username}` : profile.display_name ?? 'someone';
    try {
      await Share.share({ message: `${who} on KazeTune\n${url}`, url });
    } catch {
      // dismissed
    }
  };

  const onReport = () => promptReport('profile', id, 'person');

  const onToggleBlock = () => {
    if (blocked) {
      (async () => {
        try {
          setBusy(true);
          await unblockUser(id);
          setBlocked(false);
          load();
        } catch (e: any) {
          Alert.alert('Could not unblock', e?.message ?? String(e));
        } finally {
          setBusy(false);
        }
      })();
      return;
    }
    const who = profile?.username ? `@${profile.username}` : profile?.display_name ?? 'this person';
    Alert.alert(
      `Block ${who}?`,
      "You won't see each other's pins, playlists, or profiles, and you'll be removed as friends.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusy(true);
              await blockUser(id);
              setBlocked(true);
              setStatus('none');
              setPins([]);
              setPlaylists([]);
              refreshBadge();
            } catch (e: any) {
              Alert.alert('Could not block', e?.message ?? String(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.text} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.textMuted }}>User not found.</Text>
      </View>
    );
  }

  const friendLabel =
    status === 'accepted'
      ? 'Friends ✓'
      : status === 'pending_outgoing'
        ? 'Requested'
        : status === 'pending_incoming'
          ? 'Accept request'
          : '+ Add friend';

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.container}>
      <Avatar uri={profile.avatar_url} name={profile.display_name} size={104} />
      <Text style={styles.name}>{profile.display_name ?? '(unnamed)'}</Text>
      {profile.username && (
        <Text style={[styles.username, { color: c.primary }]}>@{profile.username}</Text>
      )}

      {!isMe && !blocked && (
        <Pressable
          style={[
            styles.friendBtn,
            {
              backgroundColor: status === 'accepted' ? c.secondaryButton : c.primary,
            },
            busy && styles.disabled,
          ]}
          onPress={onFriendAction}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={status === 'accepted' ? c.text : c.primaryText} />
          ) : (
            <Text
              style={[
                styles.friendBtnText,
                { color: status === 'accepted' ? c.text : c.primaryText },
              ]}
            >
              {friendLabel}
            </Text>
          )}
        </Pressable>
      )}

      {!blocked && (
        <Pressable
          style={[styles.shareBtn, { backgroundColor: c.secondaryButton }]}
          onPress={onShare}
        >
          <Text style={[styles.shareBtnText, { color: c.text }]}>↗ Share profile</Text>
        </Pressable>
      )}

      {!isMe && (
        <RNView style={styles.modRow}>
          <Pressable onPress={onReport} hitSlop={8}>
            <Text style={[styles.modText, { color: c.textMuted }]}>⚑ Report</Text>
          </Pressable>
          <Text style={[styles.modDot, { color: c.textSubtle }]}>·</Text>
          <Pressable onPress={onToggleBlock} hitSlop={8} disabled={busy}>
            <Text style={[styles.modText, { color: c.danger }]}>
              {blocked ? 'Unblock' : 'Block'}
            </Text>
          </Pressable>
        </RNView>
      )}

      {blocked ? (
        <Text style={[styles.blockedNote, { color: c.textSubtle }]}>
          You blocked this person. Their pins and playlists are hidden.
        </Text>
      ) : (
        <>
      {/* ---- Pins ---- */}
      <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
        Pins ({pins.length})
      </Text>
      {pins.length === 0 ? (
        <Text style={[styles.empty, { color: c.textSubtle }]}>Nothing to show here.</Text>
      ) : (
        pins.map((p) => (
          <Pressable
            key={p.id}
            style={[styles.row, { backgroundColor: c.card }]}
            onPress={() => router.push({ pathname: '/pin-detail', params: { id: p.id } })}
          >
            {p.image_url || p.album_image_url ? (
              <Image source={{ uri: p.image_url ?? p.album_image_url! }} style={styles.thumb} />
            ) : (
              <RNView style={[styles.thumb, { backgroundColor: c.primary }]} />
            )}
            <RNView style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>{p.track_name}</Text>
              <Text style={[styles.rowSub, { color: c.textMuted }]} numberOfLines={1}>
                {p.artist_name}
                {p.place_name ? ` · ${p.place_name}` : ''}
              </Text>
            </RNView>
          </Pressable>
        ))
      )}

      {/* ---- Playlists ---- */}
      {playlists.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: c.textMuted, marginTop: 24 }]}>
            Playlists ({playlists.length})
          </Text>
          {playlists.map((pl) => (
            <Pressable
              key={pl.id}
              style={[styles.row, { backgroundColor: c.card }]}
              onPress={() => router.push({ pathname: '/playlist-detail', params: { id: pl.id } })}
            >
              {pl.cover_image_url ? (
                <Image source={{ uri: pl.cover_image_url }} style={styles.thumb} />
              ) : (
                <RNView style={[styles.thumb, { backgroundColor: c.primary }]} />
              )}
              <RNView style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>{pl.title}</Text>
                <Text style={[styles.rowSub, { color: c.textMuted }]}>
                  {pl.pin_count} pin{pl.pin_count === 1 ? '' : 's'}
                </Text>
              </RNView>
            </Pressable>
          ))}
        </>
      )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, alignItems: 'center', paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 24, fontWeight: '800', marginTop: 12 },
  username: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  friendBtn: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    minWidth: 200,
    alignItems: 'center',
  },
  friendBtnText: { fontWeight: '700', fontSize: 15 },
  shareBtn: {
    marginTop: 10,
    paddingVertical: 11,
    paddingHorizontal: 28,
    borderRadius: 24,
    minWidth: 200,
    alignItems: 'center',
  },
  shareBtnText: { fontWeight: '600', fontSize: 14 },
  modRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  modText: { fontSize: 13, fontWeight: '600' },
  modDot: { fontSize: 13 },
  blockedNote: {
    marginTop: 28,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  sectionLabel: {
    alignSelf: 'flex-start',
    fontSize: 12,
    textTransform: 'uppercase',
    marginTop: 28,
    marginBottom: 8,
  },
  empty: { alignSelf: 'flex-start', fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    alignSelf: 'stretch',
  },
  thumb: { width: 44, height: 44, borderRadius: 6 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  disabled: { opacity: 0.6 },
});
