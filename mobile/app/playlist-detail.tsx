// Playlist detail modal — shows the playlist's metadata, its pins in
// order, and lets the owner remove pins or delete the playlist.

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View as RNView,
} from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';
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
  const c = useThemeColors();
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
        <ActivityIndicator color={c.text} />
      </View>
    );
  }

  if (!playlist) {
    return (
      <View style={styles.center}>
        <Text style={[styles.muted, { color: c.textMuted }]}>
          Playlist not found.
        </Text>
        <Pressable
          style={[styles.closeBtn, { backgroundColor: c.walkingActive }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.closeBtnText, { color: '#fff' }]}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {playlist.cover_image_url && (
          <Image
            source={{ uri: playlist.cover_image_url }}
            style={styles.cover}
          />
        )}
        <Text style={styles.title}>{playlist.title}</Text>
        <Text style={[styles.sub, { color: c.textMuted }]}>
          {pins.length} pin{pins.length === 1 ? '' : 's'}
          {playlist.is_public ? ' · public' : ''}
        </Text>
        {playlist.description && (
          <Text style={[styles.desc, { color: c.textMuted }]}>
            {playlist.description}
          </Text>
        )}
        <Pressable
          style={[
            styles.walkBtn,
            { backgroundColor: walking ? c.walkingActive : c.primary },
            pins.length === 0 && styles.disabled,
          ]}
          onPress={toggleWalking}
          disabled={pins.length === 0}
        >
          <Text style={[styles.walkBtnText, { color: c.primaryText }]}>
            {walking ? 'Stop walking' : '▶ Walk this playlist'}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.routeBtn,
            { borderColor: c.primary },
            pins.length < 2 && styles.disabled,
          ]}
          onPress={() =>
            // Cast: expo-router auto-generates the typed-route table
            // the first time Metro restarts after adding a new file.
            router.push({
              pathname: '/playlist-route' as never,
              params: { id },
            } as never)
          }
          disabled={pins.length < 2}
        >
          <Text style={[styles.routeBtnText, { color: c.primary }]}>
            View suggested route
          </Text>
        </Pressable>
        {walkingMsg && (
          <Text style={[styles.walkMsg, { color: c.textMuted }]}>
            {walkingMsg}
          </Text>
        )}
      </View>

      <FlatList
        data={pins}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.textMuted }]}>
            Empty. Tap a pin from the Map tab → "Add to playlist".
          </Text>
        }
        renderItem={({ item, index }) => (
          <Pressable
            style={[styles.row, { backgroundColor: c.card }]}
            onPress={() =>
              router.push({ pathname: '/pin-detail', params: { id: item.id } })
            }
          >
            <Text style={[styles.rowIndex, { color: c.textSubtle }]}>
              {index + 1}
            </Text>
            {item.image_url || item.album_image_url ? (
              <Image
                source={{ uri: item.image_url ?? item.album_image_url! }}
                style={styles.thumb}
              />
            ) : (
              <RNView style={[styles.thumb, { backgroundColor: c.primary }]}>
                <Text style={[styles.thumbLetter, { color: c.primaryText }]}>
                  {item.track_name.charAt(0).toUpperCase()}
                </Text>
              </RNView>
            )}
            <RNView style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.track_name}
              </Text>
              <Text
                style={[styles.rowSub, { color: c.textMuted }]}
                numberOfLines={1}
              >
                {item.artist_name}
                {item.place_name ? ` · ${item.place_name}` : ''}
              </Text>
            </RNView>
            {playlist.is_mine && (
              <Pressable
                style={[styles.removeBtn, { backgroundColor: c.secondaryButton }]}
                onPress={() => removePin(item.id)}
                disabled={busy}
                hitSlop={8}
              >
                <Text style={[styles.removeBtnText, { color: c.textMuted }]}>
                  ×
                </Text>
              </Pressable>
            )}
          </Pressable>
        )}
      />

      {playlist.is_mine && (
        <Pressable
          style={[
            styles.deleteBtn,
            { borderColor: c.danger },
            busy && styles.disabled,
          ]}
          onPress={deleteThisPlaylist}
          disabled={busy}
        >
          <Text style={[styles.deleteBtnText, { color: c.danger }]}>
            Delete playlist
          </Text>
        </Pressable>
      )}

      {nowPlaying && (
        <View style={[styles.nowPlaying, { backgroundColor: c.overlay }]}>
          <Text
            style={[styles.nowPlayingTitle, { color: c.overlayText }]}
            numberOfLines={1}
          >
            ▶ {nowPlaying.track_name}
          </Text>
          <Text
            style={[styles.nowPlayingSubtitle, { color: c.overlaySubtext }]}
            numberOfLines={1}
          >
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
  cover: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '700' },
  sub: { fontSize: 13 },
  desc: { fontSize: 14, marginTop: 6 },

  list: { paddingVertical: 8, gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 12,
  },
  rowIndex: { width: 22, textAlign: 'right', fontWeight: '700' },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbLetter: { fontWeight: '800', fontSize: 16 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12 },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { fontSize: 18 },

  empty: { textAlign: 'center', marginTop: 32 },
  muted: { fontSize: 16 },

  closeBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  closeBtnText: { fontWeight: '600' },

  deleteBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  deleteBtnText: { fontWeight: '700' },
  disabled: { opacity: 0.5 },

  walkBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
  },
  walkBtnText: { fontWeight: '700' },
  routeBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  routeBtnText: { fontWeight: '600' },
  walkMsg: { fontSize: 12, marginTop: 6 },

  nowPlaying: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 12,
  },
  nowPlayingTitle: { fontWeight: '700', fontSize: 14 },
  nowPlayingSubtitle: { fontSize: 12, marginTop: 2 },
});
