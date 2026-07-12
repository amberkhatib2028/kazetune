// Edit playlist modal — change a playlist's cover, title, description,
// and public/private. Owner-only; reached from playlist-detail. Mirrors
// the inline create form on the Playlists tab.

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { Text, View, useThemeColors } from '@/components/Themed';
import { pickImage, uploadImage } from '@/lib/images';
import { listPlaylists, updatePlaylist } from '@/lib/playlists';

export default function EditPlaylistScreen() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pickingCover, setPickingCover] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  // The already-saved remote cover (kept unless replaced/removed).
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  // A freshly picked local image, uploaded on save.
  const [localCoverUri, setLocalCoverUri] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = await listPlaylists();
        const pl = all.find((p) => p.id === id);
        if (!mounted || !pl) return;
        setTitle(pl.title);
        setDescription(pl.description ?? '');
        setIsPublic(pl.is_public);
        setCoverUrl(pl.cover_image_url ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

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

  const removeCover = () => {
    setLocalCoverUri(null);
    setCoverUrl(null);
  };

  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Title required', 'Give your playlist a name.');
      return;
    }
    try {
      setBusy(true);
      Keyboard.dismiss();
      // If a new cover was picked, upload it; otherwise keep whatever
      // coverUrl currently is (unchanged, or null if removed).
      let finalCover = coverUrl;
      if (localCoverUri) finalCover = await uploadImage('playlist', localCoverUri);

      await updatePlaylist(id, {
        title: trimmed,
        description: description.trim() || null,
        isPublic,
        coverImageUrl: finalCover,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? String(e));
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

  const shownCover = localCoverUri ?? coverUrl;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView
        style={{ backgroundColor: c.background }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.label, { color: c.textMuted }]}>Cover</Text>
        <Pressable
          style={[
            styles.coverBox,
            { backgroundColor: c.inputBackground, borderColor: c.border },
            pickingCover && styles.disabled,
          ]}
          onPress={chooseCover}
          disabled={pickingCover}
        >
          {shownCover ? (
            <Image source={{ uri: shownCover }} style={styles.coverPreview} />
          ) : (
            <Text style={[styles.coverHint, { color: c.textMuted }]}>
              {pickingCover ? 'Opening…' : '+ Add a cover'}
            </Text>
          )}
        </Pressable>
        {shownCover && (
          <Pressable onPress={removeCover} hitSlop={8}>
            <Text style={[styles.coverClear, { color: c.textMuted }]}>Remove cover</Text>
          </Pressable>
        )}

        <Text style={[styles.label, { color: c.textMuted }]}>Title</Text>
        <TextInput
          style={[
            styles.input,
            { borderColor: c.border, color: c.inputText, backgroundColor: c.inputBackground },
          ]}
          value={title}
          onChangeText={setTitle}
          placeholder="My walk playlist"
          placeholderTextColor={c.placeholder}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
        />

        <Text style={[styles.label, { color: c.textMuted }]}>Description (optional)</Text>
        <TextInput
          style={[
            styles.input,
            styles.multiline,
            { borderColor: c.border, color: c.inputText, backgroundColor: c.inputBackground },
          ]}
          value={description}
          onChangeText={setDescription}
          placeholder="What's this playlist about?"
          placeholderTextColor={c.placeholder}
          multiline
        />

        <RNView style={styles.publicRow}>
          <Text style={[styles.label, { color: c.textMuted, marginBottom: 0 }]}>
            Public (others can see)
          </Text>
          <Switch value={isPublic} onValueChange={setIsPublic} />
        </RNView>

        <Pressable
          style={[styles.saveBtn, { backgroundColor: c.primary }, busy && styles.disabled]}
          onPress={save}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={c.primaryText} />
          ) : (
            <Text style={[styles.saveBtnText, { color: c.primaryText }]}>Save changes</Text>
          )}
        </Pressable>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60, gap: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  coverBox: {
    height: 160,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverPreview: { width: '100%', height: '100%' },
  coverHint: { fontSize: 15, fontWeight: '600' },
  coverClear: { fontSize: 13, marginTop: 8, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  publicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  saveBtn: {
    marginTop: 28,
    paddingVertical: 15,
    borderRadius: 26,
    alignItems: 'center',
  },
  saveBtnText: { fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.5 },
});
