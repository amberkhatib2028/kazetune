// Pick-a-song modal — reached from a long-press on the Map tab. Same
// Spotify search as the Search tab, but on track-select we forward
// both the picked track AND the original tap location to /create-pin
// so the user lands on the pin form pre-filled with everything.
//
// Why a separate file instead of a flag on the Search tab:
//   - The Search tab is a top-level tab; pushing it onto the modal
//     stack with params is awkward in expo-router.
//   - This screen has a meaningfully different vibe (header tells you
//     what's happening, no "search a song or artist" hint).

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';
import { searchTracks, type SpotifyTrack } from '@/lib/spotify';

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PickSongForLocationScreen() {
  const c = useThemeColors();
  const { latitude, longitude } = useLocalSearchParams<{
    latitude: string;
    longitude: string;
  }>();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Debounced auto-search — identical to the Search tab.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setErrorText(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const tracks = await searchTracks(trimmed);
        if (cancelled) return;
        setErrorText(null);
        setResults(tracks);
      } catch (err: any) {
        if (cancelled) return;
        setErrorText(err?.message ?? 'Search failed');
        setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  const hasQuery = query.trim().length > 0;

  // Format coords as a short hint so the user remembers where they
  // tapped. Two decimal degrees ≈ city-scale; users tapping the map
  // know roughly where they meant.
  const coordHint = `${parseFloat(latitude).toFixed(4)}, ${parseFloat(longitude).toFixed(4)}`;

  return (
    <View style={styles.container}>
      <RNView style={styles.header}>
        <Text style={styles.title}>Pick a song</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          Pinning at {coordHint}
        </Text>
      </RNView>

      <RNView style={styles.searchRow}>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: c.border,
              backgroundColor: c.inputBackground,
              color: c.inputText,
            },
          ]}
          placeholder="Search a song or artist..."
          placeholderTextColor={c.placeholder}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {hasQuery && (
          <Pressable
            style={[styles.clearBtn, { backgroundColor: c.secondaryButton }]}
            onPress={() => setQuery('')}
            hitSlop={8}
          >
            <Text style={[styles.clearBtnText, { color: c.text }]}>×</Text>
          </Pressable>
        )}
        {loading && (
          <RNView style={styles.spinnerInline}>
            <ActivityIndicator color={c.text} />
          </RNView>
        )}
      </RNView>

      {errorText && (
        <Text style={[styles.error, { color: c.danger }]}>{errorText}</Text>
      )}

      <FlatList
        data={results}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => {
              router.replace({
                pathname: '/create-pin',
                params: {
                  trackId: item.id,
                  trackName: item.name,
                  artistName: item.artists.map((a) => a.name).join(', '),
                  durationMs: item.duration_ms.toString(),
                  albumImageUrl: item.album.images[0]?.url ?? '',
                  previewUrl: item.preview_url ?? '',
                  latitude,
                  longitude,
                },
              });
            }}
          >
            {item.album.images[0] ? (
              <Image
                source={{ uri: item.album.images[0].url }}
                style={styles.albumArt}
              />
            ) : (
              <RNView
                style={[styles.albumArt, { backgroundColor: c.card }]}
              />
            )}
            <RNView style={styles.rowText}>
              <Text style={styles.trackName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text
                style={[styles.artist, { color: c.textMuted }]}
                numberOfLines={1}
              >
                {item.artists.map((a) => a.name).join(', ')}
              </Text>
            </RNView>
            <Text style={[styles.duration, { color: c.textSubtle }]}>
              {formatDuration(item.duration_ms)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          !loading && !errorText && hasQuery ? (
            <Text style={[styles.empty, { color: c.textMuted }]}>
              No results.
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 4, fontFamily: 'SpaceMono' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: { fontSize: 18, lineHeight: 20 },
  spinnerInline: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { marginBottom: 12 },

  list: { paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  albumArt: { width: 48, height: 48, borderRadius: 4 },
  rowText: { flex: 1 },
  trackName: { fontSize: 16, fontWeight: '500' },
  artist: { fontSize: 14, marginTop: 2 },
  duration: { fontSize: 12, marginLeft: 8 },
  empty: { textAlign: 'center', marginTop: 32 },
});
