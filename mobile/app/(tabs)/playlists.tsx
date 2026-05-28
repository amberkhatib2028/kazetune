// Playlists tab — list your playlists + public ones, inline-create new
// ones at the top. Tapping a row opens the playlist-detail modal.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { createPlaylist, listPlaylists, type Playlist } from '@/lib/playlists';

export default function PlaylistsScreen() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setPlaylists(await listPlaylists());
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load playlists');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Give your playlist a name.');
      return;
    }
    try {
      setBusy(true);
      await createPlaylist({
        title: title.trim(),
        description: description.trim() || null,
        isPublic,
      });
      setTitle('');
      setDescription('');
      setIsPublic(false);
      setCreating(false);
      await load();
    } catch (e: any) {
      Alert.alert('Could not create', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Playlists</Text>
        <Pressable
          style={styles.newBtn}
          onPress={() => setCreating((c) => !c)}
        >
          <Text style={styles.newBtnText}>{creating ? '× Cancel' : '+ New'}</Text>
        </Pressable>
      </View>

      {creating && (
        <View style={styles.createForm}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="My walk playlist"
            placeholderTextColor="#999"
            autoFocus
          />
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="What's this playlist about?"
            placeholderTextColor="#999"
            multiline
          />
          <View style={styles.publicRow}>
            <Text style={styles.label}>Public (others can see)</Text>
            <Switch value={isPublic} onValueChange={setIsPublic} />
          </View>
          <Pressable
            style={[styles.saveBtn, busy && styles.disabled]}
            onPress={save}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Create playlist</Text>
            )}
          </Pressable>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No playlists yet — tap + New to make one.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() =>
                router.push({
                  pathname: '/playlist-detail',
                  params: { id: item.id },
                })
              }
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {item.pin_count} pin{item.pin_count === 1 ? '' : 's'}
                  {item.is_public && ' · public'}
                </Text>
                {item.description && (
                  <Text style={styles.rowDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '700' },
  newBtn: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newBtnText: { color: 'white', fontWeight: '700' },

  createForm: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    marginBottom: 16,
    gap: 4,
  },
  label: { fontSize: 12, opacity: 0.6, marginTop: 8, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
    marginTop: 4,
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  publicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  saveBtn: {
    backgroundColor: '#1DB954',
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: { color: 'white', fontWeight: '700' },
  disabled: { opacity: 0.6 },

  list: { paddingBottom: 32, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 13, opacity: 0.6 },
  rowDesc: { fontSize: 12, opacity: 0.6, marginTop: 4 },
  mineBadge: {
    fontSize: 10,
    color: '#1DB954',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  empty: { textAlign: 'center', opacity: 0.5, marginTop: 32 },

  errorBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#c00',
    padding: 12,
    borderRadius: 8,
  },
  errorText: { color: 'white' },
});
