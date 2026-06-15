// Edit Pin modal — opened from the Pin Detail screen via the Edit
// button. Lets the owner change place name, location, clip start /
// duration, public/private, and the user-uploaded photo. The
// underlying Spotify track is fixed (delete + recreate to change it).

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import ClipRangeSlider from '@/components/ClipRangeSlider';
import { PinLocationMap } from '@/components/PinLocationMap';
import { Text, View, useThemeColors } from '@/components/Themed';
import { VisibilitySelector } from '@/components/VisibilitySelector';
import { pickImage, uploadImage } from '@/lib/images';
import { listPins, updatePin, type Pin, type PinVisibility } from '@/lib/pins';
import { getTrack } from '@/lib/spotify';
import {
  PlaybackError,
  playTrackSegment,
  stopPinClip,
} from '@/lib/spotifyPlayback';

const MIN_CLIP_SEC = 20;
const MAX_CLIP_SEC = 45;

export default function EditPinScreen() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [pin, setPin] = useState<Pin | null>(null);
  const [loading, setLoading] = useState(true);

  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [description, setDescription] = useState('');
  const [startSeconds, setStartSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(20);
  const [visibility, setVisibility] = useState<PinVisibility>('private');

  // Full track length — pins don't store it, so we fetch from Spotify to
  // scope the clip slider. 0 until loaded (or if the fetch fails).
  const [trackDurationSec, setTrackDurationSec] = useState(0);

  // Clip-preview playback state (mirrors create-pin).
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);
  const previewBlocked = useRef(false);
  const previewStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Photo state. `existingImageUrl` is whatever was on the pin when
  // we loaded it. `localPhotoUri` is a freshly-picked local file (not
  // yet uploaded). `removeExistingPhoto` is true when the user tapped
  // "Remove photo" and there's no replacement queued.
  //
  // Save logic:
  //   - localPhotoUri set      → upload it, store the new public URL
  //   - removeExistingPhoto    → store '' to clear server-side
  //   - neither                → keep existingImageUrl unchanged
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);

  const [saving, setSaving] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  // Load the pin via list_pins (consistent with pin-detail.tsx — same
  // RLS, no extra RPC needed).
  const load = useCallback(async () => {
    try {
      const pins = await listPins();
      const found = pins.find((p) => p.id === id) ?? null;
      if (!found) {
        Alert.alert('Pin not found');
        router.back();
        return;
      }
      if (!found.is_mine) {
        Alert.alert('You can only edit your own pins.');
        router.back();
        return;
      }
      setPin(found);
      // Prefill form.
      setLatitude(found.latitude.toString());
      setLongitude(found.longitude.toString());
      setPlaceName(found.place_name ?? '');
      setDescription(found.description ?? '');
      setStartSeconds(found.start_seconds);
      setDurationSeconds(found.duration_seconds);
      setVisibility(found.visibility);
      setExistingImageUrl(found.image_url);

      // Recover the full track length for the clip slider. Best-effort:
      // on failure we fall back to a length that at least fits the clip.
      try {
        const track = await getTrack(found.spotify_track_id);
        setTrackDurationSec(Math.floor(track.duration_ms / 1000));
      } catch {
        setTrackDurationSec(found.start_seconds + found.duration_seconds);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Stop any preview audio when leaving the screen.
  useEffect(() => {
    return () => {
      if (previewStopTimer.current) clearTimeout(previewStopTimer.current);
      stopPinClip().catch(() => {});
    };
  }, []);

  const handlePreviewError = (e: unknown) => {
    const reason = e instanceof PlaybackError ? e.reason : 'UNKNOWN';
    previewBlocked.current = reason !== 'UNKNOWN';
    if (reason === 'NO_DEVICE') {
      setPreviewMsg('Open Spotify on your phone and play any song once, then tap Listen.');
    } else if (reason === 'PREMIUM_REQUIRED') {
      setPreviewMsg('Previewing the clip needs Spotify Premium.');
    } else if (reason === 'EXPIRED' || reason === 'NO_TOKEN') {
      setPreviewMsg('Spotify session expired — sign in again to preview.');
    } else {
      setPreviewMsg((e as any)?.message ?? 'Could not preview this clip.');
    }
  };

  const playPreview = async () => {
    if (!pin) return;
    setPreviewMsg(null);
    previewBlocked.current = false;
    setPreviewLoading(true);
    try {
      await playTrackSegment(pin.spotify_track_id, startSeconds, durationSeconds);
      setPreviewPlaying(true);
      if (previewStopTimer.current) clearTimeout(previewStopTimer.current);
      previewStopTimer.current = setTimeout(
        () => setPreviewPlaying(false),
        durationSeconds * 1000,
      );
    } catch (e) {
      setPreviewPlaying(false);
      handlePreviewError(e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const stopPreview = async () => {
    if (previewStopTimer.current) clearTimeout(previewStopTimer.current);
    await stopPinClip();
    setPreviewPlaying(false);
  };

  const togglePreview = () => {
    if (previewPlaying) stopPreview();
    else playPreview();
  };

  const onSliderRelease = () => {
    if (previewBlocked.current) return;
    playPreview();
  };

  const choosePhoto = async () => {
    try {
      setPickingPhoto(true);
      const uri = await pickImage();
      if (uri) {
        setLocalPhotoUri(uri);
        setRemoveExistingPhoto(false); // picking implies replacing
      }
    } catch (e: any) {
      Alert.alert('Could not pick photo', e?.message ?? String(e));
    } finally {
      setPickingPhoto(false);
    }
  };

  const removePhoto = () => {
    setLocalPhotoUri(null);
    setRemoveExistingPhoto(true);
  };

  const save = async () => {
    if (!pin) return;
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const start = Math.round(startSeconds);
    const dur = Math.round(durationSeconds);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      Alert.alert('Invalid location', 'Latitude and longitude must be numbers.');
      return;
    }
    if (dur < MIN_CLIP_SEC) {
      Alert.alert('Clip too short', `Clip must be at least ${MIN_CLIP_SEC} seconds.`);
      return;
    }
    if (dur > MAX_CLIP_SEC) {
      Alert.alert('Clip too long', `Clip can be at most ${MAX_CLIP_SEC} seconds.`);
      return;
    }

    try {
      await stopPreview();
      setSaving(true);

      // Resolve final image_url:
      //   - if a new local photo is queued, upload and use that URL
      //   - if the user asked to remove the photo, use ''
      //   - otherwise keep the existing URL
      let finalImageUrl: string | null;
      if (localPhotoUri) {
        finalImageUrl = await uploadImage('pin', localPhotoUri);
      } else if (removeExistingPhoto) {
        finalImageUrl = '';
      } else {
        finalImageUrl = existingImageUrl;
      }

      await updatePin({
        pinId: pin.id,
        latitude: lat,
        longitude: lng,
        placeName,
        startSeconds: start,
        durationSeconds: dur,
        visibility,
        imageUrl: finalImageUrl,
        description: description.trim(),
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Could not save changes', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !pin) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.text} />
      </View>
    );
  }

  // What to show in the photo box:
  //   - new local URI takes priority
  //   - else existing remote URL (unless the user asked to remove it)
  //   - else nothing (Add a photo prompt)
  // The user's own photo (freshly picked or previously uploaded), if any.
  const userPhotoUri =
    localPhotoUri ??
    (!removeExistingPhoto && existingImageUrl ? existingImageUrl : null);
  // What to actually show: the user's photo, else the album cover default.
  const photoPreviewUri = userPhotoUri ?? pin.album_image_url;

  const inputStyle = [
    styles.input,
    {
      borderColor: c.border,
      backgroundColor: c.inputBackground,
      color: c.inputText,
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <RNView style={[styles.trackCard, { backgroundColor: c.card }]}>
        {pin.album_image_url ? (
          <Image source={{ uri: pin.album_image_url }} style={styles.albumArt} />
        ) : (
          <RNView style={[styles.albumArt, { backgroundColor: c.primary }]}>
            <Text style={[styles.albumLetter, { color: c.primaryText }]}>
              {pin.track_name.charAt(0).toUpperCase()}
            </Text>
          </RNView>
        )}
        <RNView style={styles.trackText}>
          <Text style={styles.trackName} numberOfLines={2}>
            {pin.track_name}
          </Text>
          <Text
            style={[styles.artist, { color: c.textMuted }]}
            numberOfLines={1}
          >
            {pin.artist_name}
          </Text>
          <Text style={[styles.trackHint, { color: c.textSubtle }]}>
            To change the song, delete this pin and create a new one.
          </Text>
        </RNView>
      </RNView>

      <Text style={styles.section}>Photo</Text>
      <Text style={[styles.hint, { color: c.textSubtle }]}>
        Defaults to the album cover — tap to use your own.
      </Text>
      <Pressable
        style={[
          styles.photoBox,
          { backgroundColor: c.card, borderColor: c.border },
          pickingPhoto && styles.disabled,
        ]}
        onPress={choosePhoto}
        disabled={pickingPhoto}
      >
        {photoPreviewUri ? (
          <Image source={{ uri: photoPreviewUri }} style={styles.photoPreview} />
        ) : (
          <Text style={[styles.photoHint, { color: c.textMuted }]}>
            {pickingPhoto ? 'Opening…' : '+ Add a photo'}
          </Text>
        )}
      </Pressable>
      {userPhotoUri && (
        <Pressable onPress={removePhoto} hitSlop={8}>
          <Text style={[styles.photoClear, { color: c.textMuted }]}>
            Remove photo (use album cover)
          </Text>
        </Pressable>
      )}

      <Text style={styles.section}>Location</Text>
      <PinLocationMap
        initialLat={parseFloat(latitude)}
        initialLng={parseFloat(longitude)}
        onChange={(lat, lng) => {
          setLatitude(lat.toString());
          setLongitude(lng.toString());
        }}
      />

      <Text style={[styles.label, { color: c.textMuted }]}>
        Place name (optional)
      </Text>
      <TextInput
        style={inputStyle}
        value={placeName}
        onChangeText={setPlaceName}
        placeholder="Defaults to the nearest place"
        placeholderTextColor={c.placeholder}
      />

      <Text style={styles.section}>Why here? (optional)</Text>
      <TextInput
        style={[inputStyle, styles.noteInput]}
        value={description}
        onChangeText={setDescription}
        placeholder="What makes this song belong at this spot?"
        placeholderTextColor={c.placeholder}
        multiline
        maxLength={500}
      />

      <Text style={styles.section}>Clip</Text>
      <Text style={[styles.hint, { color: c.textSubtle }]}>
        Drag to choose the part that plays here — {MIN_CLIP_SEC}–{MAX_CLIP_SEC}s.
      </Text>
      {trackDurationSec > 0 && (
        <ClipRangeSlider
          totalSec={trackDurationSec}
          startSec={startSeconds}
          durationSec={durationSeconds}
          minDurationSec={MIN_CLIP_SEC}
          maxDurationSec={MAX_CLIP_SEC}
          onChange={(s, d) => {
            setStartSeconds(s);
            setDurationSeconds(d);
          }}
          onPreview={onSliderRelease}
          isPlaying={previewPlaying}
          loadingPreview={previewLoading}
          onTogglePlay={togglePreview}
        />
      )}
      {previewMsg && (
        <Text style={[styles.hint, { color: c.textMuted }]}>{previewMsg}</Text>
      )}

      <Text style={styles.section}>Who can see this?</Text>
      <VisibilitySelector value={visibility} onChange={setVisibility} />

      <Pressable
        style={[
          styles.saveButton,
          { backgroundColor: c.primary },
          saving && styles.disabled,
        ]}
        onPress={save}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={c.primaryText} />
        ) : (
          <Text style={[styles.saveButtonText, { color: c.primaryText }]}>
            Save changes
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 4, paddingBottom: 64 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  trackCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  albumArt: {
    width: 72,
    height: 72,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  albumLetter: { fontSize: 36, fontWeight: '800' },
  trackText: { flex: 1, gap: 2 },
  trackName: { fontSize: 16, fontWeight: '600' },
  artist: { fontSize: 13 },
  trackHint: { fontSize: 11, marginTop: 6 },

  section: { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  label: { fontSize: 12, marginTop: 8, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginTop: 4,
  },
  hint: { fontSize: 12, marginTop: 4 },
  noteInput: { minHeight: 80, paddingTop: 10, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  publicRow: { alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },

  locButton: {
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 8,
  },
  locButtonText: { fontWeight: '600' },

  saveButton: {
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonText: { fontWeight: '700', fontSize: 16 },

  disabled: { opacity: 0.6 },

  photoBox: {
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 4,
  },
  photoPreview: { width: '100%', height: '100%' },
  photoHint: { fontSize: 14, fontWeight: '600' },
  photoClear: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
