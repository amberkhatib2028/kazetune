// Web fallback for the Map tab. Same data + walking mode as native,
// just rendered as a list since react-native-maps doesn't run in the
// browser. Use Chrome DevTools > Sensors > Geolocation to simulate
// movement.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';
import { listPins, type Pin } from '@/lib/pins';
import { useWalkingMode } from '@/lib/useWalkingMode';

export default function NativeMapWeb() {
  const c = useThemeColors();
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { walking, nowPlaying, message: walkingMsg, toggle } = useWalkingMode(pins);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pins</Text>
        <Pressable
          style={[
            styles.toggleBtn,
            { backgroundColor: walking ? c.walkingActive : c.primary },
          ]}
          onPress={toggle}
          disabled={loading}
        >
          <Text style={[styles.toggleBtnText, { color: c.primaryText }]}>
            {walking ? 'Stop walking' : 'Start walking'}
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.hint, { color: c.textMuted }]}>
        Web map isn't supported. To simulate walking: Chrome DevTools (⌥⌘I)
        → ⋮ → More tools → Sensors → set Geolocation to one of the pins below.
      </Text>

      {walkingMsg && (
        <Text style={[styles.msg, { backgroundColor: c.card, color: c.text }]}>
          {walkingMsg}
        </Text>
      )}

      {loading ? (
        <ActivityIndicator color={c.text} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={pins}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: c.textMuted }]}>
              No pins yet—go to Search, pick a track, and save one.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.row,
                {
                  backgroundColor:
                    nowPlaying?.id === item.id ? c.cardHighlight : c.card,
                },
              ]}
              onPress={() =>
                router.push({ pathname: '/pin-detail', params: { id: item.id } })
              }
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.place_name ?? item.track_name}
                </Text>
                <Text
                  style={[styles.rowSub, { color: c.textMuted }]}
                  numberOfLines={1}
                >
                  {item.track_name}—{item.artist_name}
                </Text>
                <Text style={[styles.rowCoords, { color: c.textSubtle }]}>
                  {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                </Text>
              </View>
              {item.is_mine && (
                <Text style={[styles.mineBadge, { color: c.primary }]}>
                  yours
                </Text>
              )}
            </Pressable>
          )}
        />
      )}

      {error && (
        <View style={[styles.errorBar, { backgroundColor: c.danger }]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
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
  toggleBtnText: { fontWeight: '700' },

  hint: { fontSize: 12, marginBottom: 8 },
  msg: {
    padding: 8,
    borderRadius: 6,
    fontSize: 12,
    marginVertical: 4,
    overflow: 'hidden',
  },

  list: { paddingBottom: 96, gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 13 },
  rowCoords: { fontSize: 11, marginTop: 2 },
  mineBadge: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  empty: { textAlign: 'center', marginTop: 32 },

  errorBar: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
  },
  errorText: { color: 'white' },

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
