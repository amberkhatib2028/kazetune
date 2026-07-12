// Playlists tab — list your playlists + public ones, inline-create new
// ones at the top. Tapping a row opens the playlist-detail modal.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableWithoutFeedback,
  View as RNView,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { Text, View, useThemeColors } from '@/components/Themed';
import { listFriendSummary } from '@/lib/friends';
import { pickImage, uploadImage } from '@/lib/images';
import { createPlaylist, listPlaylists, type Playlist } from '@/lib/playlists';

// Mine/Friends/Everyone all live inside YOUR LIBRARY (playlists you made
// or saved), filtered by who made them. Discover is the opposite — public
// playlists you haven't saved yet, for finding new ones.
type PlaylistFilter = 'mine' | 'friends' | 'everyone' | 'discover';
const PLAYLIST_FILTERS: { key: PlaylistFilter; label: string }[] = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'mine', label: 'Mine' },
  { key: 'friends', label: 'Friends' },
  { key: 'discover', label: 'Discover' },
];

export default function PlaylistsScreen() {
  const c = useThemeColors();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<PlaylistFilter>('everyone');
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
      const [pls, friends] = await Promise.all([
        listPlaylists(),
        listFriendSummary().catch(() => []),
      ]);
      setPlaylists(pls);
      const ids = new Set<string>();
      for (const f of friends) if (f.status === 'accepted') ids.add(f.other_id);
      setFriendIds(ids);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load playlists');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // "Mine" = made or saved. A friend's public playlist only shows up
  // under Friends/Everyone, not your library.
  const visible = useMemo(() => {
    const isFriendPl = (p: Playlist) =>
      !p.is_mine && !!p.user_id && friendIds.has(p.user_id);
    const inLibrary = (p: Playlist) => p.is_mine || p.is_saved;
    return playlists.filter((p) => {
      switch (filter) {
        case 'mine':
          // In your library, made by you.
          return p.is_mine;
        case 'friends':
          // In your library (saved), made by a friend.
          return p.is_saved && isFriendPl(p);
        case 'discover':
          // Public playlists you haven't saved (and didn't make).
          return p.is_public && !inLibrary(p);
        case 'everyone':
        default:
          // Your whole library — made or saved, from anyone.
          return inLibrary(p);
      }
    });
  }, [playlists, friendIds, filter]);

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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
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
        </TouchableWithoutFeedback>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterBar}
      >
        {PLAYLIST_FILTERS.map((f) => {
          const sel = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, { backgroundColor: sel ? c.primary : c.card }]}
            >
              <Text style={[styles.chipText, { color: sel ? c.primaryText : c.text }]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={c.text} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon="music.note.list"
              title={filter === 'discover' ? 'Nothing to discover' : 'No playlists yet'}
              subtitle={
                filter === 'discover'
                  ? "Public playlists from others will show up here."
                  : 'Tap + New to make one, or save one from Discover.'
              }
            />
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

  filterScroll: { flexGrow: 0, marginBottom: 12 },
  filterBar: { gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  chipText: { fontWeight: '600', fontSize: 13 },

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
