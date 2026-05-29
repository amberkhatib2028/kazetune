// Playlists tab — list your playlists + public ones, inline-create new
// ones at the top. Tapping a row opens the playlist-detail modal.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View as RNView,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Text, View, useThemeColors } from '@/components/Themed';
import { pickImage, uploadImage } from '@/lib/images';
import { createPlaylist, listPlaylists, type Playlist } from '@/lib/playlists';

export default function PlaylistsScreen() {
  const c = useThemeColors();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [localCoverUri, setLocalCoverUri] = useState<string | null>(null);
  const [pickingCover, setPickingCover] = useState(false);

  const chooseCover = async () => {
    try {
      setPickingCover(true);
      const uri = await pickImage();
      if (uri) setLocalCoverUri(uri);
    } catch (e: any) {
      Alert.alert('Could not pick image', e?.message ?? String(e));
    } finally {
      setPickingCover(false);
    }
  };

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

      // Upload cover (if any) first, then create the playlist row.
      let coverUrl: string | null = null;
      if (localCoverUri) {
        coverUrl = await uploadImage('playlist', localCoverUri);
      }

      await createPlaylist({
        title: title.trim(),
        description: description.trim() || null,
        isPublic,
        coverImageUrl: coverUrl,
      });
      setTitle('');
      setDescription('');
      setIsPublic(false);
      setLocalCoverUri(null);
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
          style={[styles.newBtn, { backgroundColor: c.primary }]}
          onPress={() => setCreating((cur) => !cur)}
        >
          <Text style={[styles.newBtnText, { color: c.primaryText }]}>
            {creating ? '× Cancel' : '+ New'}
          </Text>
        </Pressable>
      </View>

      {creating && (
        <View style={[styles.createForm, { backgroundColor: c.card }]}>
          <Text style={[styles.label, { color: c.textMuted }]}>Cover (optional)</Text>
          <Pressable
            style={[
              styles.coverBox,
              { backgroundColor: c.inputBackground, borderColor: c.border },
              pickingCover && styles.disabled,
            ]}
            onPress={chooseCover}
            disabled={pickingCover}
          >
            {localCoverUri ? (
              <Image source={{ uri: localCoverUri }} style={styles.coverPreview} />
            ) : (
              <Text style={[styles.coverHint, { color: c.textMuted }]}>
                {pickingCover ? 'Opening…' : '+ Add a cover'}
              </Text>
            )}
          </Pressable>
          {localCoverUri && (
            <Pressable onPress={() => setLocalCoverUri(null)} hitSlop={8}>
              <Text style={[styles.coverClear, { color: c.textMuted }]}>
                Remove cover
              </Text>
            </Pressable>
          )}

          <Text style={[styles.label, { color: c.textMuted }]}>Title</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: c.border,
                color: c.inputText,
                backgroundColor: c.inputBackground,
              },
            ]}
            value={title}
            onChangeText={setTitle}
            placeholder="My walk playlist"
            placeholderTextColor={c.placeholder}
            autoFocus
          />
          <Text style={[styles.label, { color: c.textMuted }]}>
            Description (optional)
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.multiline,
              {
                borderColor: c.border,
                color: c.inputText,
                backgroundColor: c.inputBackground,
              },
            ]}
            value={description}
            onChangeText={setDescription}
            placeholder="What's this playlist about?"
            placeholderTextColor={c.placeholder}
            multiline
          />
          <View style={styles.publicRow}>
            <Text style={[styles.label, { color: c.textMuted }]}>
              Public (others can see)
            </Text>
            <Switch value={isPublic} onValueChange={setIsPublic} />
          </View>
          <Pressable
            style={[
              styles.saveBtn,
              { backgroundColor: c.primary },
              busy && styles.disabled,
            ]}
            onPress={save}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={c.primaryText} />
            ) : (
              <Text style={[styles.saveBtnText, { color: c.primaryText }]}>
                Create playlist
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={c.text} />
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: c.textMuted }]}>
              No playlists yet — tap + New to make one.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, { backgroundColor: c.card }]}
              onPress={() =>
                router.push({
                  pathname: '/playlist-detail',
                  params: { id: item.id },
                })
              }
            >
              {item.cover_image_url ? (
                <Image
                  source={{ uri: item.cover_image_url }}
                  style={styles.coverThumb}
                />
              ) : (
                <RNView
                  style={[styles.coverThumb, { backgroundColor: c.primary }]}
                >
                  <Text
                    style={[styles.coverLetter, { color: c.primaryText }]}
                  >
                    {item.title.charAt(0).toUpperCase()}
                  </Text>
                </RNView>
              )}
              <RNView style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text
                  style={[styles.rowSub, { color: c.textMuted }]}
                  numberOfLines={1}
                >
                  {item.pin_count} pin{item.pin_count === 1 ? '' : 's'}
                  {item.is_public && ' · public'}
                </Text>
                {!item.is_mine && item.owner_display_name && (
                  <RNView style={styles.ownerRow}>
                    <Avatar
                      uri={item.owner_avatar_url}
                      name={item.owner_display_name}
                      size={16}
                    />
                    <Text
                      style={[styles.rowOwner, { color: c.textMuted }]}
                      numberOfLines={1}
                    >
                      {item.owner_display_name}
                    </Text>
                  </RNView>
                )}
                {item.description && (
                  <Text
                    style={[styles.rowDesc, { color: c.textMuted }]}
                    numberOfLines={2}
                  >
                    {item.description}
                  </Text>
                )}
              </RNView>
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
          <Text style={{ color: 'white' }}>{error}</Text>
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
  newBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  newBtnText: { fontWeight: '700' },

  createForm: { padding: 16, borderRadius: 12, marginBottom: 16, gap: 4 },
  label: { fontSize: 12, marginTop: 8, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
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
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: { fontWeight: '700' },
  disabled: { opacity: 0.6 },

  list: { paddingBottom: 32, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  coverThumb: {
    width: 52,
    height: 52,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverLetter: { fontWeight: '800', fontSize: 22, color: '#fff' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 13 },
  rowDesc: { fontSize: 12, marginTop: 4 },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  rowOwner: { fontSize: 12 },
  mineBadge: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  empty: { textAlign: 'center', marginTop: 32 },

  coverBox: {
    marginTop: 4,
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverPreview: { width: '100%', height: '100%' },
  coverHint: { fontSize: 14, fontWeight: '600' },
  coverClear: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },

  errorBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
  },
});
