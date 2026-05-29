// "Add to playlist" picker — opened from the pin-detail modal.

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';
import { addPinToPlaylist, listPlaylists, type Playlist } from '@/lib/playlists';

export default function AddToPlaylistScreen() {
  const c = useThemeColors();
  const { pinId } = useLocalSearchParams<{ pinId: string }>();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await listPlaylists();
      setPlaylists(all.filter((p) => p.is_mine));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (playlistId: string) => {
    try {
      setBusyId(playlistId);
      await addPinToPlaylist(playlistId, pinId);
      router.back();
    } catch (e: any) {
      Alert.alert('Could not add', e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.text} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add to playlist</Text>
      <FlatList
        data={playlists}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.textMuted }]}>
            You don't have any playlists yet — make one in the Playlists tab first.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.row,
              { backgroundColor: c.card },
              busyId === item.id && styles.disabled,
            ]}
            onPress={() => add(item.id)}
            disabled={busyId !== null}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.rowSub, { color: c.textMuted }]}>
                {item.pin_count} pin{item.pin_count === 1 ? '' : 's'}
              </Text>
            </View>
            {busyId === item.id && <ActivityIndicator color={c.text} />}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  list: { paddingBottom: 32, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 32 },
  disabled: { opacity: 0.6 },
});
