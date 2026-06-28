// Feed tab — shows recent public pins and playlists from your
// accepted friends, newest first. Empty state nudges you to add
// friends. Tap any row to open the underlying pin or playlist.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View as RNView,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { Text, View, useThemeColors } from '@/components/Themed';
import {
  listFriendActivity,
  type FriendActivityItem,
} from '@/lib/friends';
import { listDiscover } from '@/lib/discover';
import { type Pin } from '@/lib/pins';
import { type Playlist } from '@/lib/playlists';

type FeedMode = 'friends' | 'discover';

// Unified shape so Discover can render pins and playlists in one list.
type DiscoverRow = {
  kind: 'pin' | 'playlist';
  id: string;
  title: string;
  sub: string;
  image: string | null;
};

export default function FeedScreen() {
  const c = useThemeColors();
  const [mode, setMode] = useState<FeedMode>('friends');
  const [items, setItems] = useState<FriendActivityItem[]>([]);
  const [discover, setDiscover] = useState<DiscoverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (m: FeedMode) => {
    try {
      setError(null);
      if (m === 'friends') {
        setItems(await listFriendActivity());
      } else {
        const { pins, playlists } = await listDiscover();
        const rows: DiscoverRow[] = [
          ...pins.map((p: Pin) => ({
            kind: 'pin' as const,
            id: p.id,
            title: p.track_name,
            sub: `${p.artist_name}${p.place_name ? ` · ${p.place_name}` : ''}`,
            image: p.image_url ?? p.album_image_url,
          })),
          ...playlists.map((pl: Playlist) => ({
            kind: 'playlist' as const,
            id: pl.id,
            title: pl.title,
            sub: `Playlist · ${pl.pin_count} pin${pl.pin_count === 1 ? '' : 's'}${
              pl.owner_display_name ? ` · ${pl.owner_display_name}` : ''
            }`,
            image: pl.cover_image_url,
          })),
        ];
        setDiscover(rows);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(mode); }, [load, mode]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(mode);
  }, [load, mode]);

  const switchMode = (m: FeedMode) => {
    if (m === mode) return;
    setLoading(true);
    setMode(m);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          {mode === 'friends'
            ? 'What your friends have been pinning.'
            : 'Public pins & playlists from around KazeTune.'}
        </Text>
      </View>

      <RNView style={[styles.segment, { backgroundColor: c.card }]}>
        {(['friends', 'discover'] as FeedMode[]).map((m) => (
          <Pressable
            key={m}
            style={[
              styles.segmentBtn,
              mode === m && { backgroundColor: c.primary },
            ]}
            onPress={() => switchMode(m)}
          >
            <Text
              style={[
                styles.segmentText,
                { color: mode === m ? c.primaryText : c.textMuted },
              ]}
            >
              {m === 'friends' ? 'Friends' : 'Discover'}
            </Text>
          </Pressable>
        ))}
      </RNView>

      {loading ? (
        <ActivityIndicator color={c.text} style={{ marginTop: 32 }} />
      ) : mode === 'friends' ? (
        <FlatList
          data={items}
          keyExtractor={(it) => `${it.kind}-${it.id}`}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.text}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="sparkles"
              title="Nothing here yet"
              subtitle="When friends drop pins or make playlists, they'll show up here."
            />
          }
          renderItem={({ item }) => (
            <ActivityRow
              item={item}
              primaryColor={c.primary}
              cardColor={c.card}
              textMuted={c.textMuted}
              textSubtle={c.textSubtle}
            />
          )}
        />
      ) : (
        <FlatList
          data={discover}
          keyExtractor={(it) => `${it.kind}-${it.id}`}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.text}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="safari"
              title="Nothing to discover yet"
              subtitle="Public pins and playlists from other people will show up here."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, { backgroundColor: c.card }]}
              onPress={() =>
                router.push({
                  pathname: item.kind === 'pin' ? '/pin-detail' : '/playlist-detail',
                  params: { id: item.id },
                })
              }
            >
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.thumb} />
              ) : (
                <RNView style={[styles.thumb, { backgroundColor: c.primary }]}>
                  <Text style={styles.thumbLetter}>
                    {item.title.charAt(0).toUpperCase()}
                  </Text>
                </RNView>
              )}
              <RNView style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  <Text style={styles.rowNameBold}>{item.title}</Text>
                </Text>
                <Text
                  style={[styles.rowSub, { color: c.textMuted }]}
                  numberOfLines={1}
                >
                  {item.sub}
                </Text>
              </RNView>
            </Pressable>
          )}
        />
      )}

      {error && (
        <View style={[styles.errorBar, { backgroundColor: c.danger }]}>
          <Text style={{ color: 'white' }}>{error}</Text>
        </View>
      )}
    </View>
  );
}

function ActivityRow({
  item,
  primaryColor,
  cardColor,
  textMuted,
  textSubtle,
}: {
  item: FriendActivityItem;
  primaryColor: string;
  cardColor: string;
  textMuted: string;
  textSubtle: string;
}) {
  const onPress = () => {
    if (item.kind === 'pin') {
      router.push({ pathname: '/pin-detail', params: { id: item.id } });
    } else {
      router.push({ pathname: '/playlist-detail', params: { id: item.id } });
    }
  };

  // Compose the action sentence. Examples:
  //   "amber pinned Skinny Love at Yerba Buena"
  //   "amber created playlist Princeton walk"
  const name = item.friend_display_name ?? 'A friend';
  const action =
    item.kind === 'pin'
      ? item.place_name
        ? `pinned ${item.title} at ${item.place_name}`
        : `pinned ${item.title}`
      : `created playlist "${item.title}"`;

  return (
    <Pressable
      style={[styles.row, { backgroundColor: cardColor }]}
      onPress={onPress}
    >
      <Avatar
        uri={item.friend_avatar_url}
        name={item.friend_display_name}
        size={36}
      />
      <RNView style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          <Text style={styles.rowNameBold}>{name}</Text>
          <Text style={{ color: textMuted }}> {action}</Text>
        </Text>
        {item.subtitle && (
          <Text
            style={[styles.rowSub, { color: textMuted }]}
            numberOfLines={1}
          >
            {item.subtitle}
          </Text>
        )}
        <Text style={[styles.rowTime, { color: textSubtle }]}>
          {formatRelativeTime(item.created_at)}
          {item.kind === 'playlist' && '  ·  Playlist'}
        </Text>
      </RNView>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.thumb} />
      ) : (
        <RNView style={[styles.thumb, { backgroundColor: primaryColor }]}>
          <Text style={styles.thumbLetter}>
            {item.title.charAt(0).toUpperCase()}
          </Text>
        </RNView>
      )}
    </Pressable>
  );
}

// "12 min ago" / "3 hr ago" / "Apr 12" style.
function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },

  segment: {
    flexDirection: 'row',
    borderRadius: 22,
    padding: 4,
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: 'center',
  },
  segmentText: { fontWeight: '700', fontSize: 14 },

  list: { paddingBottom: 32, gap: 8, flexGrow: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 12,
  },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 14, lineHeight: 18 },
  rowNameBold: { fontWeight: '700' },
  rowSub: { fontSize: 12 },
  rowTime: { fontSize: 11, marginTop: 2 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLetter: { color: 'white', fontWeight: '800', fontSize: 18 },

  empty: { padding: 32, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '600' },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  errorBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
  },
});
