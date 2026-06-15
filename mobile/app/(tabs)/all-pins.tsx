// All Pins tab — scrollable list of every pin the user can see,
// with a Mine / Friends / Everyone filter at the top.
//
// The map and the geofence-walker still operate on all visible pins;
// this filter is purely about which rows show in this list. We load
// the friend ID set in parallel with the pins so switching to the
// Friends tab is instant.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View as RNView,
} from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Text, View, useThemeColors } from '@/components/Themed';
import { listFriendSummary } from '@/lib/friends';
import { listPins, type Pin } from '@/lib/pins';

type FilterMode = 'mine' | 'friends' | 'everyone';

const FILTERS: { value: FilterMode; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends', label: 'Friends' },
  { value: 'mine', label: 'Mine' },
];

export default function AllPinsScreen() {
  const c = useThemeColors();
  const [pins, setPins] = useState<Pin[]>([]);
  // user_id → display_name for accepted friends. Lets the row badge
  // show the friend's actual name ("Casey") instead of a generic
  // "FRIEND" label.
  const [friendNames, setFriendNames] = useState<Map<string, string>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<FilterMode>('everyone');

  const load = useCallback(async () => {
    try {
      setError(null);
      // Run pin + friend loads in parallel — Friends tab is instant.
      const [pinsResult, friendsResult] = await Promise.all([
        listPins(),
        listFriendSummary().catch(() => []),
      ]);
      setPins(pinsResult);
      const map = new Map<string, string>();
      for (const f of friendsResult) {
        if (f.status === 'accepted') {
          map.set(f.other_id, f.other_display_name ?? 'friend');
        }
      }
      setFriendNames(map);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load pins');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Helper — user_id is optional on Pin so guard the lookup.
  const isFriendPin = useCallback(
    (p: Pin) => !!p.user_id && friendNames.has(p.user_id),
    [friendNames],
  );
  const getFriendName = useCallback(
    (p: Pin) => (p.user_id ? friendNames.get(p.user_id) ?? 'friend' : 'friend'),
    [friendNames],
  );

  const visiblePins = useMemo(() => {
    switch (mode) {
      case 'mine':
        return pins.filter((p) => p.is_mine);
      case 'friends':
        // Strictly friends' pins. Mine and Friends are disjoint;
        // Everyone is the union.
        return pins.filter((p) => !p.is_mine && isFriendPin(p));
      case 'everyone':
      default:
        return pins;
    }
  }, [pins, isFriendPin, mode]);

  const mineCount = pins.filter((p) => p.is_mine).length;
  const friendsPublicCount = pins.filter(
    (p) => !p.is_mine && isFriendPin(p),
  ).length;
  const strangersPublicCount =
    pins.length - mineCount - friendsPublicCount;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All pins</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          {mineCount} yours
          {friendsPublicCount > 0 ? ` · ${friendsPublicCount} from friends` : ''}
          {strangersPublicCount > 0
            ? ` · ${strangersPublicCount} from everyone else`
            : ''}
        </Text>
      </View>

      {/* ---- Segmented filter ----------------------------------- */}
      <RNView style={[styles.segmented, { backgroundColor: c.card }]}>
        {FILTERS.map((f) => {
          const selected = mode === f.value;
          return (
            <Pressable
              key={f.value}
              style={[
                styles.segment,
                selected && { backgroundColor: c.primary },
              ]}
              onPress={() => setMode(f.value)}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: selected ? c.primaryText : c.text },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </RNView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={c.text} />
      ) : (
        <FlatList
          data={visiblePins}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="mappin.and.ellipse"
              title={mode === 'mine' ? 'No pins yet' : 'Nothing here'}
              subtitle={
                mode === 'mine'
                  ? 'Search a track and drop your first pin.'
                  : mode === 'friends'
                  ? "No pins from friends yet — add some, or wait for them to drop pins."
                  : 'No pins to show.'
              }
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, { backgroundColor: c.card }]}
              onPress={() =>
                router.push({ pathname: '/pin-detail', params: { id: item.id } })
              }
            >
              {item.image_url || item.album_image_url ? (
                <Image
                  source={{ uri: item.image_url ?? item.album_image_url! }}
                  style={styles.albumArt}
                />
              ) : (
                <RNView
                  style={[styles.albumArt, { backgroundColor: c.primary }]}
                >
                  <Text style={[styles.dotText, { color: c.primaryText }]}>
                    {item.track_name.charAt(0).toUpperCase()}
                  </Text>
                </RNView>
              )}
              <RNView style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.track_name}
                </Text>
                <Text style={[styles.rowSub, { color: c.textMuted }]} numberOfLines={1}>
                  {item.artist_name}
                  {item.place_name ? ` · ${item.place_name}` : ''}
                </Text>
              </RNView>
              <RNView style={styles.badges}>
                {item.is_mine && (
                  <Text style={[styles.badge, { color: c.primary }]}>yours</Text>
                )}
                {!item.is_mine && isFriendPin(item) && (
                  <Text
                    style={[styles.friendNameBadge, { color: c.primary }]}
                    numberOfLines={1}
                  >
                    {getFriendName(item)}
                  </Text>
                )}
                {!item.is_mine && !isFriendPin(item) && item.is_public && (
                  <Text style={[styles.badge, { color: c.textMuted }]}>
                    public
                  </Text>
                )}
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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },

  segmented: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
  },
  segmentText: { fontSize: 13, fontWeight: '600' },

  list: { paddingBottom: 32, gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    gap: 12,
  },
  albumArt: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dotText: { fontWeight: '800', fontSize: 20 },

  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12 },
  rowMeta: { fontSize: 11, marginTop: 2 },

  badges: { alignItems: 'flex-end', gap: 4, maxWidth: 100 },
  badge: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  // Same coral as the YOURS badge but lowercase + slightly bigger so
  // proper-noun names like "Casey" look right.
  friendNameBadge: { fontSize: 12, fontWeight: '700' },

  empty: { textAlign: 'center', marginTop: 48, paddingHorizontal: 32 },

  errorBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
  },
});
