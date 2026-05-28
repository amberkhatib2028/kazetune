// Web fallback for the Map tab.
// No native map (react-native-maps doesn't run in the browser), so we
// show a list of pins and the same Walking Mode toggle. Geofencing
// uses navigator.geolocation under the hood — you can simulate
// movement with Chrome DevTools > Sensors > Geolocation override.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { playPinClip, stopPinClip } from '@/lib/audio';
import { startWalking, type WalkingHandle } from '@/lib/geofencing';
import { listPins, type Pin } from '@/lib/pins';

export default function NativeMapWeb() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [walking, setWalking] = useState(false);
  const walkingHandle = useRef<WalkingHandle | null>(null);
  const [nowPlaying, setNowPlaying] = useState<Pin | null>(null);
  const [walkingMsg, setWalkingMsg] = useState<string | null>(null);

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

  useEffect(() => () => {
    walkingHandle.current?.stop();
    walkingHandle.current = null;
    stopPinClip();
  }, []);

  const toggleWalking = async () => {
    if (walking) {
      walkingHandle.current?.stop();
      walkingHandle.current = null;
      await stopPinClip();
      setWalking(false);
      setNowPlaying(null);
      setWalkingMsg(null);
      return;
    }
    if (pins.length === 0) {
      setWalkingMsg('No pins to walk to. Place one first.');
      return;
    }
    try {
      setWalkingMsg(null);
      const handle = await startWalking({
        pins,
        onEnter: async (pin) => {
          const played = await playPinClip(pin);
          setNowPlaying(played ? pin : null);
          setWalkingMsg(
            played ? null : `No preview audio for "${pin.track_name}"`,
          );
        },
        onExit: (pin) => {
          setNowPlaying((cur) => (cur?.id === pin.id ? null : cur));
        },
        onError: (msg) => setWalkingMsg(msg),
      });
      walkingHandle.current = handle;
      setWalking(true);
    } catch (e: any) {
      setWalkingMsg(e?.message ?? String(e));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pins</Text>
        <Pressable
          style={[
            styles.toggleBtn,
            walking ? styles.toggleBtnOn : styles.toggleBtnOff,
          ]}
          onPress={toggleWalking}
          disabled={loading}
        >
          <Text style={styles.toggleBtnText}>
            {walking ? 'Stop walking' : 'Start walking'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Web map isn't supported. To simulate walking: Chrome DevTools (⌥⌘I)
        → ⋮ → More tools → Sensors → set Geolocation to one of the pins below.
      </Text>

      {walkingMsg && <Text style={styles.msg}>{walkingMsg}</Text>}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={pins}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No pins yet — go to Search, pick a track, and save one.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.row,
                nowPlaying?.id === item.id && styles.rowPlaying,
              ]}
              onPress={() =>
                router.push({ pathname: '/pin-detail', params: { id: item.id } })
              }
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.place_name ?? item.track_name}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {item.track_name} — {item.artist_name}
                </Text>
                <Text style={styles.rowCoords}>
                  {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                  {!item.preview_url && '  · (no preview)'}
                </Text>
              </View>
              {item.is_mine && <Text style={styles.mineBadge}>yours</Text>}
            </Pressable>
          )}
        />
      )}

      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '700' },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  toggleBtnOff: { backgroundColor: '#1DB954' },
  toggleBtnOn: { backgroundColor: '#222' },
  toggleBtnText: { color: 'white', fontWeight: '700' },

  hint: { fontSize: 12, opacity: 0.6, marginBottom: 8 },
  msg: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 8,
    borderRadius: 6,
    fontSize: 12,
    marginVertical: 4,
  },

  list: { paddingBottom: 96, gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  rowPlaying: { backgroundColor: 'rgba(29,185,84,0.18)' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 13, opacity: 0.7 },
  rowCoords: { fontSize: 11, opacity: 0.5, marginTop: 2 },
  mineBadge: {
    fontSize: 10,
    color: '#1DB954',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  empty: { textAlign: 'center', opacity: 0.5, marginTop: 32 },

  errorBar: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: '#c00',
    padding: 12,
    borderRadius: 8,
  },
  errorText: { color: 'white' },

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
