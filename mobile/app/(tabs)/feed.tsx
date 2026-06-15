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

export default function FeedScreen() {
  const c = useThemeColors();
  const [items, setItems] = useState<FriendActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await listFriendActivity());
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load activity');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          What your friends have been pinning.
        </Text>
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator color={c.text} style={{ marginTop: 32 }} />
      ) : (
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
