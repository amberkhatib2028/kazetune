// Pin detail modal — shown when you tap a pin from the Map tab.
// Lets you preview the clip, toggle public/private, or delete the
// pin (only if it's yours). Loads the pin via listPins() and filters
// by id rather than hitting a dedicated RPC; same RLS still applies.

import * as Linking from 'expo-linking';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View as RNView,
} from 'react-native';

import { ClipPreview } from '@/components/ClipPreview';
import { Text, View, useThemeColors } from '@/components/Themed';
import { VisibilitySelector } from '@/components/VisibilitySelector';
import { getTrack } from '@/lib/spotify';
import {
  PlaybackError,
  getCurrentPinId,
  playPinClip,
  stopPinClip,
} from '@/lib/spotifyPlayback';
import { listPins, type Pin, type PinVisibility } from '@/lib/pins';
import { supabase } from '@/lib/supabase';

export default function PinDetailScreen() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [pin, setPin] = useState<Pin | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loadingClip, setLoadingClip] = useState(false);
  // Full track length (pins don't store it) so we can show where the clip
  // sits. 0 until loaded / if the fetch fails.
  const [trackDurationSec, setTrackDurationSec] = useState(0);

  const load = useCallback(async () => {
    try {
      const pins = await listPins();
      const found = pins.find((p) => p.id === id) ?? null;
      setPin(found);
      if (found) {
        getTrack(found.spotify_track_id)
          .then((t) => setTrackDurationSec(Math.floor(t.duration_ms / 1000)))
          .catch(() => setTrackDurationSec(0));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Reload every time the screen regains focus — not just on mount — so
  // edits made on the edit-pin screen (e.g. a new clip start) are
  // reflected when we pop back here. Also re-syncs the play/stop state.
  useFocusEffect(
    useCallback(() => {
      load();
      setPlaying(getCurrentPinId() === id);
    }, [load, id]),
  );

  const togglePlay = async () => {
    if (!pin) return;
    if (playing) {
      await stopPinClip();
      setPlaying(false);
      return;
    }
    // playPinClip drives the user's Spotify (full track, seeked to the
    // pin's start). It throws a PlaybackError with a reason when it
    // can't — surface the right guidance for each case.
    setLoadingClip(true);
    try {
      const ok = await playPinClip(pin);
      setPlaying(ok);
    } catch (e) {
      const reason = e instanceof PlaybackError ? e.reason : 'UNKNOWN';
      if (reason === 'NO_DEVICE') {
        Alert.alert(
          'Open Spotify first',
          'Start Spotify on your phone and play (then pause) any song so it becomes the active device, then tap play here again.',
        );
      } else if (reason === 'PREMIUM_REQUIRED') {
        Alert.alert(
          'Spotify Premium required',
          'Playing full tracks needs a Spotify Premium account.',
        );
      } else if (reason === 'EXPIRED' || reason === 'NO_TOKEN') {
        Alert.alert(
          'Spotify session expired',
          'Sign out and sign back in with Spotify to keep playing.',
        );
      } else {
        Alert.alert('Could not play', (e as any)?.message ?? String(e));
      }
    } finally {
      setLoadingClip(false);
    }
  };

  const onShare = async () => {
    if (!pin) return;
    // Deep link back into this exact pin. expo-linking builds a URL with
    // the app's scheme (kazetune://pin-detail?id=…) so tapping it opens
    // the app straight to this screen. Recipients can only open it if the
    // pin is visible to them — RLS keeps private pins private.
    const url = Linking.createURL('/pin-detail', { queryParams: { id: pin.id } });
    const where = pin.place_name ? ` at ${pin.place_name}` : '';
    try {
      await Share.share({
        message: `🎵 "${pin.track_name}" by ${pin.artist_name}${where} on KazeTune\n${url}`,
        url,
      });
    } catch {
      // User dismissed the share sheet, or it failed — nothing to do.
    }
  };

  const changeVisibility = async (v: PinVisibility) => {
    if (!pin || v === pin.visibility) return;
    try {
      setBusy(true);
      const { error } = await supabase
        .from('pins')
        .update({ visibility: v })
        .eq('id', pin.id);
      if (error) throw error;
      // The DB trigger keeps is_public = (visibility === 'public').
      setPin({ ...pin, visibility: v, is_public: v === 'public' });
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
          ({pin.latitude.toFixed(2)}, {pin.longitude.toFixed(2)})
        </Text>
      </View>

      {pin.description ? (
        <View style={styles.section}>
          <Text style={[styles.label, { color: c.textMuted }]}>Why here</Text>
          <Text style={[styles.note, { color: c.text }]}>{pin.description}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.label, { color: c.textMuted }]}>Clip</Text>
        {trackDurationSec > 0 ? (
          <ClipPreview
            totalSec={trackDurationSec}
            startSec={pin.start_seconds}
            durationSec={pin.duration_seconds}
          />
        ) : (
          <Text style={styles.value}>
            Starts at {pin.start_seconds}s · {pin.duration_seconds}s long
          </Text>
        )}
      </View>

      <Pressable
        style={[
          styles.playButton,
          { backgroundColor: c.primary },
          loadingClip && styles.disabled,
        ]}
        onPress={togglePlay}
        disabled={loadingClip}
      >
        {loadingClip ? (
          <ActivityIndicator color={c.primaryText} />
        ) : (
          <Text style={[styles.playButtonText, { color: c.primaryText }]}>
            {playing ? '■ Stop' : '▶ Play clip'}
          </Text>
        )}
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

      <Pressable
        style={[styles.secondaryButton, { backgroundColor: c.secondaryButton }]}
        onPress={onShare}
      >
        <Text style={[styles.secondaryButtonText, { color: c.text }]}>
          ↗ Share pin
        </Text>
      </Pressable>

      {pin.is_mine && pin.visibility === 'private' && (
        <Text style={[styles.shareHint, { color: c.textSubtle }]}>
          Private — only you can open this. Choose who can see it below.
        </Text>
      )}

      {pin.is_mine && (
        <>
          <Pressable
            style={[styles.secondaryButton, { backgroundColor: c.secondaryButton }]}
            onPress={() =>
              router.push({
                pathname: '/edit-pin' as never,
                params: { id: pin.id },
              } as never)
            }
          >
            <Text style={[styles.secondaryButtonText, { color: c.text }]}>
              ✎ Edit pin
            </Text>
          </Pressable>

          <View style={styles.section}>
            <Text style={[styles.label, { color: c.textMuted }]}>
              Who can see this
            </Text>
            <VisibilitySelector
              value={pin.visibility}
              onChange={changeVisibility}
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
  note: { fontSize: 16, lineHeight: 22, marginTop: 2 },
  shareHint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    lineHeight: 18,
  },
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
