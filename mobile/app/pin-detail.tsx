// Pin detail modal — shown when you tap a pin from the Map tab.
// Lets you preview the clip, toggle public/private, or delete the
// pin (only if it's yours). Loads the pin via listPins() and filters
// by id rather than hitting a dedicated RPC; same RLS still applies.

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View as RNView,
} from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';
import { getCurrentPinId, playPinClip, stopPinClip } from '@/lib/audio';
import { listPins, type Pin } from '@/lib/pins';
import { supabase } from '@/lib/supabase';

export default function PinDetailScreen() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [pin, setPin] = useState<Pin | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);

  const load = useCallback(async () => {
    try {
      const pins = await listPins();
      const found = pins.find((p) => p.id === id) ?? null;
      setPin(found);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    // Keep "playing" in sync if user closes and reopens while audio
    // from a previous tap is still going.
    setPlaying(getCurrentPinId() === id);
  }, [load, id]);

  const togglePlay = async () => {
    if (!pin) return;
    if (playing) {
      await stopPinClip();
      setPlaying(false);
      return;
    }
    if (!pin.preview_url) {
      Alert.alert(
        'No preview',
        'Spotify did not return a preview URL for this track.',
      );
      return;
    }
    const ok = await playPinClip(pin);
    setPlaying(ok);
  };

  const togglePublic = async () => {
    if (!pin) return;
    try {
      setBusy(true);
      const next = !pin.is_public;
      const { error } = await supabase
        .from('pins')
        .update({ is_public: next })
        .eq('id', pin.id);
      if (error) throw error;
      setPin({ ...pin, is_public: next });
    } catch (e: any) {
      Alert.alert('Could not update', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const deletePin = async () => {
    if (!pin) return;

    // Alert.alert with custom buttons doesn't fire onPress on web —
    // it falls back to window.alert which has no buttons. Use a real
    // confirm() on web and Alert on native.
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(`Delete "${pin.track_name}"?`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Delete this pin?',
              `${pin.track_name} — ${pin.artist_name}`,
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => resolve(false),
                },
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
      await stopPinClip();
      const { error } = await supabase
        .from('pins')
        .delete()
        .eq('id', pin.id);
      if (error) throw error;
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

  if (!pin) {
    return (
      <View style={styles.center}>
        <Text style={[styles.notFound, { color: c.textMuted }]}>
          Pin not found.
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: c.walkingActive }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.buttonText, { color: '#fff' }]}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {pin.image_url || pin.album_image_url ? (
        <Image
          source={{ uri: pin.image_url ?? pin.album_image_url! }}
          style={styles.albumArt}
        />
      ) : (
        <RNView style={[styles.artFallback, { backgroundColor: c.primary }]}>
          <Text style={[styles.artLetter, { color: c.primaryText }]}>
            {pin.track_name.charAt(0).toUpperCase()}
          </Text>
        </RNView>
      )}

      <Text style={styles.trackName} numberOfLines={2}>
        {pin.track_name}
      </Text>
      <Text style={[styles.artist, { color: c.textMuted }]} numberOfLines={1}>
        {pin.artist_name}
      </Text>

      <View style={styles.section}>
        <Text style={[styles.label, { color: c.textMuted }]}>Place</Text>
        <Text style={styles.value}>{pin.place_name ?? '(unnamed)'}</Text>
        <Text style={[styles.coords, { color: c.textSubtle }]}>
          {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: c.textMuted }]}>Clip</Text>
        <Text style={styles.value}>
          Starts at {pin.start_seconds}s · {pin.duration_seconds}s long
        </Text>
        {!pin.preview_url && (
          <Text style={[styles.muted, { color: c.textSubtle }]}>
            Spotify doesn't have a preview for this track — playback won't work.
          </Text>
        )}
      </View>

      <Pressable
        style={[
          styles.playButton,
          { backgroundColor: c.primary },
          !pin.preview_url && styles.disabled,
        ]}
        onPress={togglePlay}
        disabled={!pin.preview_url}
      >
        <Text style={[styles.playButtonText, { color: c.primaryText }]}>
          {playing ? '■ Stop' : '▶ Play clip'}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, { backgroundColor: c.secondaryButton }]}
        onPress={() =>
          router.push({
            pathname: '/add-to-playlist',
            params: { pinId: pin.id },
          })
        }
      >
        <Text style={[styles.secondaryButtonText, { color: c.text }]}>
          + Add to playlist
        </Text>
      </Pressable>

      {pin.is_mine && (
        <>
          <View style={[styles.row, styles.publicRow]}>
            <Text style={styles.value}>Public (others can see)</Text>
            <Switch
              value={pin.is_public}
              onValueChange={togglePublic}
              disabled={busy}
            />
          </View>

          <Pressable
            style={[
              styles.deleteButton,
              { borderColor: c.danger },
              busy && styles.disabled,
            ]}
            onPress={deletePin}
            disabled={busy}
          >
            <Text style={[styles.deleteButtonText, { color: c.danger }]}>
              Delete pin
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, alignItems: 'center', paddingBottom: 64 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  albumArt: {
    width: 140,
    height: 140,
    borderRadius: 12,
    marginBottom: 16,
  },
  artFallback: {
    width: 140,
    height: 140,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  artLetter: { fontSize: 64, fontWeight: '800' },

  trackName: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  artist: { fontSize: 16, marginTop: 4, textAlign: 'center' },

  section: { width: '100%', marginTop: 24, gap: 4 },
  label: { fontSize: 11, textTransform: 'uppercase' },
  value: { fontSize: 16, fontWeight: '500' },
  coords: { fontSize: 12, fontFamily: 'SpaceMono' },
  muted: { fontSize: 12, marginTop: 4 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  publicRow: { width: '100%', marginTop: 24 },

  playButton: {
    marginTop: 32,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 32,
    minWidth: 200,
    alignItems: 'center',
  },
  playButtonText: { fontWeight: '700', fontSize: 16 },

  secondaryButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    minWidth: 180,
    alignItems: 'center',
  },
  secondaryButtonText: { fontWeight: '600' },

  deleteButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    minWidth: 180,
    alignItems: 'center',
  },
  deleteButtonText: { fontWeight: '700' },

  button: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  buttonText: { fontWeight: '600' },

  notFound: { fontSize: 16 },
  disabled: { opacity: 0.4 },
});
