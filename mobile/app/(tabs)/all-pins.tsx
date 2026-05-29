// All Pins tab — scrollable list of every pin the user can see.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  View as RNView,
} from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';
import { listPins, type Pin } from '@/lib/pins';

export default function AllPinsScreen() {
  const c = useThemeColors();
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setPins(await listPins());
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load pins');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const mineCount = pins.filter((p) => p.is_mine).length;
  const publicCount = pins.length - mineCount;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All pins</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          {pins.length} total · {mineCount} yours
          {publicCount > 0 ? ` · ${publicCount} public` : ''}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={c.text} />
      ) : (
        <FlatList
          data={pins}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: c.textMuted }]}>
              No pins yet. Search a track and save your first one.
            </Text>
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
                  {item.place_name ?? item.track_name}
                </Text>
                <Text style={[styles.rowSub, { color: c.textMuted }]} numberOfLines={1}>
                  {item.track_name} — {item.artist_name}
                </Text>
                <Text style={[styles.rowMeta, { color: c.textSubtle }]}>
                  {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                  {!item.preview_url && '  ·  no preview'}
                </Text>
              </RNView>
              <RNView style={styles.badges}>
                {item.is_mine && (
                  <Text style={[styles.badge, { color: c.primary }]}>yours</Text>
                )}
                {!item.is_mine && item.is_public && (
                  <Text style={[styles.badge, { color: c.textMuted }]}>public</Text>
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

  badges: { alignItems: 'flex-end', gap: 4 },
  badge: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  empty: { textAlign: 'center', marginTop: 48 },

  errorBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
  },
});
