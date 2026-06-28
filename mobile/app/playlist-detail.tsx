// Playlist detail modal — shows the playlist's metadata, its pins in
// order, and lets the owner remove pins or delete the playlist.

import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  View as RNView,
} from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';
import { promptReport } from '@/lib/moderation';
import { listPins, type Pin } from '@/lib/pins';
import {
  deletePlaylist,
  listPlaylistPins,
  listPlaylists,
  removePinFromPlaylist,
  savePlaylist,
  unsavePlaylist,
  type Playlist,
  type PlaylistPin,
} from '@/lib/playlists';
import { useWalkingMode } from '@/lib/useWalkingMode';
import { usePublicPinPolicy } from '@/lib/walkingPreference';

export default function PlaylistDetailScreen() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [pins, setPins] = useState<PlaylistPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // A playlist walk can ALSO pick up other people's public pins along
  // the way. This is now a per-walk choice (`includePublic`), seeded
  // from the global default in Settings — so you can run one playlist in
  // focused mode and another in discovery mode without changing Settings.
  const policy = usePublicPinPolicy();
  const [includePublic, setIncludePublic] = useState(policy === 'always');
  const [extraPublicPins, setExtraPublicPins] = useState<Pin[]>([]);

  // PlaylistPin has every field Pin has (plus `pos`), so structural
  // typing lets us mix the two arrays into a Pin[] for the hook.
  const walkablePins = useMemo<Pin[]>(() => {
    if (!includePublic || extraPublicPins.length === 0) return pins;
    const playlistIds = new Set(pins.map((p) => p.id));
    const extras = extraPublicPins.filter((p) => !playlistIds.has(p.id));
    return [...pins, ...extras];
  }, [pins, extraPublicPins, includePublic]);

  const { walking, nowPlaying, message: walkingMsg, toggle: toggleWalking } =
    useWalkingMode(walkablePins);

  // Keep the toggle synced to the global default until a walk starts —
  // mainly to pick up the persisted policy if it loads after mount. The
  // !walking guard means we never change it mid-walk.
  useEffect(() => {
    if (!walking) setIncludePublic(policy === 'always');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policy]);

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

  // Lazy-load the full pin set only when this walk includes public pins.
  useEffect(() => {
    if (!includePublic) {
      setExtraPublicPins([]);
      return;
    }
    let cancelled = false;
    listPins()
      .then((all) => {
        if (cancelled) return;
        // Only public pins from other users — your own already show
        // up in your global walk and you don't want duplicates.
        setExtraPublicPins(all.filter((p) => p.is_public && !p.is_mine));
      })
      .catch(() => {
        if (!cancelled) setExtraPublicPins([]);
      });
    return () => {
      cancelled = true;
    };
  }, [includePublic]);

  const toggleSave = async () => {
    if (!playlist) return;
    try {
      setBusy(true);
      if (playlist.is_saved) {
        await unsavePlaylist(id);
        setPlaylist({ ...playlist, is_saved: false });
      } else {
        await savePlaylist(id);
        setPlaylist({ ...playlist, is_saved: true });
      }
    } catch (e: any) {
      Alert.alert('Could not update', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onShare = async () => {
    if (!playlist) return;
    const url = Linking.createURL('/playlist-detail', { queryParams: { id } });
    try {
      await Share.share({
        message: `${playlist.title}—a playlist on KazeTune\n${url}`,
        url,
      });
    } catch {
      // dismissed
    }
  };

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
        {pins.length > 0 && (
          <RNView style={[styles.toggleRow, { backgroundColor: c.card }]}>
            <RNView style={styles.toggleText}>
              <Text style={styles.toggleTitle}>Pick up public pins</Text>
              <Text style={[styles.toggleSub, { color: c.textMuted }]}>
                Also play nearby public pins from others on this walk.
              </Text>
            </RNView>
            <Switch
              value={includePublic}
              onValueChange={setIncludePublic}
              disabled={walking}
            />
          </RNView>
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
        <Pressable
          style={[styles.routeBtn, { borderColor: c.primary }]}
          onPress={onShare}
        >
          <Text style={[styles.routeBtnText, { color: c.primary }]}>
            ↗ Share playlist
          </Text>
        </Pressable>
        {!playlist.is_mine && (
          <Pressable
            style={[
              styles.routeBtn,
              { borderColor: c.primary },
              busy && styles.disabled,
            ]}
            onPress={toggleSave}
            disabled={busy}
          >
            <Text style={[styles.routeBtnText, { color: c.primary }]}>
              {playlist.is_saved ? '♥ Saved to library' : '♡ Save to library'}
            </Text>
          </Pressable>
        )}
        {!playlist.is_mine && (
          <Pressable
            style={styles.reportBtn}
            onPress={() => promptReport('playlist', id, 'playlist')}
            hitSlop={8}
          >
            <Text style={[styles.reportText, { color: c.textMuted }]}>
              ⚑ Report playlist
            </Text>
          </Pressable>
        )}
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

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 15, fontWeight: '600' },
  toggleSub: { fontSize: 12 },
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
  reportBtn: { marginTop: 12, paddingVertical: 6, alignItems: 'center' },
  reportText: { fontSize: 13, fontWeight: '600' },
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
