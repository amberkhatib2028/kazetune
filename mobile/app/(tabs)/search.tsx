// Spotify search screen.
// Debounced auto-search as the user types. Tap a result to open the
// "create pin" modal pre-filled with that track.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';
import { searchTracks, type SpotifyTrack } from '@/lib/spotify';

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SearchScreen() {
  const c = useThemeColors();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Debounced auto-search: wait 300ms after the user stops typing.
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

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
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
          <View style={styles.spinnerInline}>
            <ActivityIndicator color={c.text} />
          </View>
        )}
      </View>

      {errorText && (
        <Text style={[styles.error, { color: c.danger }]}>{errorText}</Text>
      )}

      {!hasQuery ? (
        <View style={styles.hintWrap}>
          <Text style={styles.hintTitle}>Pin a song to a place</Text>
          <Text style={[styles.hintBody, { color: c.textMuted }]}>
            Search for any track on Spotify, tap it, set a location and a
            ≥20-second clip. It'll play when someone walks past.
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => {
                router.push({
                  pathname: '/create-pin',
                  params: {
                    trackId: item.id,
                    trackName: item.name,
                    artistName: item.artists.map((a) => a.name).join(', '),
                    durationMs: item.duration_ms.toString(),
                    albumImageUrl: item.album.images[0]?.url ?? '',
                    previewUrl: item.preview_url ?? '',
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
                <View
                  style={[styles.albumArt, { backgroundColor: c.card }]}
                />
              )}
              <View style={styles.rowText}>
                <Text style={styles.trackName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text
                  style={[styles.artist, { color: c.textMuted }]}
                  numberOfLines={1}
                >
                  {item.artists.map((a) => a.name).join(', ')}
                </Text>
              </View>
              <Text style={[styles.duration, { color: c.textSubtle }]}>
                {formatDuration(item.duration_ms)}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            !loading && !errorText ? (
              <Text style={[styles.empty, { color: c.textMuted }]}>
                No results.
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
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

  hintWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  hintTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  hintBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

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
