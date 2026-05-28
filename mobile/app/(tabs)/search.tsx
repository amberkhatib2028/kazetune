// Spotify search screen.
// Type a query → hit search → see results from the user's Spotify.
// Tapping a result currently just logs it; in the next step it'll
// pre-fill the "create pin" form.

import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { searchTracks, type SpotifyTrack } from '@/lib/spotify';

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const doSearch = async () => {
    try {
      setErrorText(null);
      setLoading(true);
      const tracks = await searchTracks(query);
      setResults(tracks);
    } catch (err: any) {
      setErrorText(err?.message ?? 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search a song or artist..."
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={doSearch}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={doSearch}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Search</Text>
          )}
        </Pressable>
      </View>

      {errorText && <Text style={styles.error}>{errorText}</Text>}

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
              <View style={[styles.albumArt, styles.albumArtFallback]} />
            )}
            <View style={styles.rowText}>
              <Text style={styles.trackName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.artist} numberOfLines={1}>
                {item.artists.map((a) => a.name).join(', ')}
              </Text>
            </View>
            <Text style={styles.duration}>{formatDuration(item.duration_ms)}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          !loading && query.length > 0 && !errorText ? (
            <Text style={styles.empty}>No results.</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#f7f7f7',
  },
  button: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 24,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#c00', marginBottom: 12 },
  list: { paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  albumArt: { width: 48, height: 48, borderRadius: 4, backgroundColor: '#eee' },
  albumArtFallback: { backgroundColor: '#ddd' },
  rowText: { flex: 1 },
  trackName: { fontSize: 16, fontWeight: '500' },
  artist: { fontSize: 14, opacity: 0.6, marginTop: 2 },
  duration: { fontSize: 12, opacity: 0.5, marginLeft: 8 },
  empty: { textAlign: 'center', opacity: 0.5, marginTop: 32 },
});
