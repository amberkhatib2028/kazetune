// Playlist detail modal — shows the playlist's metadata, its pins in
// order, and lets the owner remove pins or delete the playlist.

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import {
  deletePlaylist,
  listPlaylistPins,
  listPlaylists,
  removePinFromPlaylist,
  type Playlist,
  type PlaylistPin,
} from '@/lib/playlists';
import { useWalkingMode } from '@/lib/useWalkingMode';

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [pins, setPins] = useState<PlaylistPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Walking mode scoped to this playlist's pins only. PlaylistPin has
  // every field Pin has (plus `pos`), so structural typing lets us pass
  // them straight through.
  const { walking, nowPlaying, message: walkingMsg, toggle: toggleWalking } =
    useWalkingMode(pins);

  const load = useCallback(async () => {
    try {
      const [all, plPins] = await Promise.all([
        listPlaylists(),
        listPlaylistPins(id),
      ]);
      setPlaylist(all.find((p) => p.id === id) ?? null);
      setPins(plPins);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const removePin = async (pinId: string) => {
    try {
      setBusy(true);
      await removePinFromPlaylist(id, pinId);
      setPins((cur) => cur.filter((p) => p.id !== pinId));
    } catch (e: any) {
      Alert.alert('Could not remove', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteThisPlaylist = async () => {
    if (!playlist) return;
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(`Delete playlist "${playlist.title}"?`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Delete playlist?',
              playlist.title,
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => resolve(true),
                },
              ],
            );
          });
    if (!confirmed) return;
    try {
      setBusy(true);
      await deletePlaylist(id);
      router.back();
    } catch (e: any) {
      Alert.alert('Could not delete', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!playlist) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Playlist not found.</Text>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{playlist.title}</Text>
        <Text style={styles.sub}>
          {pins.length} pin{pins.length === 1 ? '' : 's'}
          {playlist.is_public ? ' · public' : ''}
        </Text>
        {playlist.description && (
          <Text style={styles.desc}>{playlist.description}</Text>
        )}
        <Pressable
          style={[
            styles.walkBtn,
            walking ? styles.walkBtnOn : styles.walkBtnOff,
            pins.length === 0 && styles.disabled,
          ]}
          onPress={toggleWalking}
          disabled={pins.length === 0}
        >
          <Text style={styles.walkBtnText}>
            {walking ? 'Stop walking' : '▶ Walk this playlist'}
          </Text>
        </Pressable>
        {walkingMsg && <Text style={styles.walkMsg}>{walkingMsg}</Text>}
      </View>

      <FlatList
        data={pins}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Empty. Tap a pin from the Map tab → "Add to playlist".
          </Text>
        }
        renderItem={({ item, index }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              router.push({ pathname: '/pin-detail', params: { id: item.id } })
            }
          >
            <Text style={styles.rowIndex}>{index + 1}</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.track_name}
              </Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {item.artist_name}
                {item.place_name ? ` · ${item.place_name}` : ''}
              </Text>
            </View>
            {playlist.is_mine && (
              <Pressable
                style={styles.removeBtn}
                onPress={() => removePin(item.id)}
                disabled={busy}
                hitSlop={8}
              >
                <Text style={styles.removeBtnText}>×</Text>
              </Pressable>
            )}
          </Pressable>
        )}
      />

      {playlist.is_mine && (
        <Pressable
          style={[styles.deleteBtn, busy && styles.disabled]}
          onPress={deleteThisPlaylist}
          disabled={busy}
        >
          <Text style={styles.deleteBtnText}>Delete playlist</Text>
        </Pressable>
      )}

      {nowPlaying && (
        <View style={styles.nowPlaying}>
          <Text style={styles.nowPlayingTitle} numberOfLines={1}>
            ▶ {nowPlaying.track_name}
          </Text>
          <Text style={styles.nowPlayingSubtitle} numberOfLines={1}>
            {nowPlaying.artist_name} · {nowPlaying.place_name ?? 'pin'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  header: { marginBottom: 12, gap: 4 },
  title: { fontSize: 24, fontWeight: '700' },
  sub: { fontSize: 13, opacity: 0.6 },
  desc: { fontSize: 14, opacity: 0.7, marginTop: 6 },

  list: { paddingVertical: 8, gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
    gap: 12,
  },
  rowIndex: {
    width: 22,
    textAlign: 'right',
    opacity: 0.4,
    fontWeight: '700',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, opacity: 0.6 },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { fontSize: 18, opacity: 0.6 },

  empty: { textAlign: 'center', opacity: 0.5, marginTop: 32 },
  muted: { fontSize: 16, opacity: 0.7 },

  closeBtn: {
    marginTop: 16,
    backgroundColor: '#444',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  closeBtnText: { color: 'white', fontWeight: '600' },

  deleteBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#c00',
    alignItems: 'center',
  },
  deleteBtnText: { color: '#c00', fontWeight: '700' },
  disabled: { opacity: 0.5 },

  walkBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
  },
  walkBtnOff: { backgroundColor: '#1DB954' },
  walkBtnOn: { backgroundColor: '#222' },
  walkBtnText: { color: 'white', fontWeight: '700' },
  walkMsg: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 6,
  },

  nowPlaying: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(20,20,20,0.92)',
    padding: 12,
    borderRadius: 12,
  },
  nowPlayingTitle: { color: 'white', fontWeight: '700', fontSize: 14 },
  nowPlayingSubtitle: { color: '#bbb', fontSize: 12, marginTop: 2 },
});
