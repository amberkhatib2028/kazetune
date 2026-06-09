// Modal screen — fill in location + clip details for a Spotify track
// the user picked from the Search tab, then INSERT via the create_pin
// RPC (handles the geography type + auth.uid() server-side).

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
} from 'react-native';
import * as Location from 'expo-location';

import ClipRangeSlider from '@/components/ClipRangeSlider';
import { Text, View, useThemeColors } from '@/components/Themed';
import { pickImage, uploadImage } from '@/lib/images';
import {
  PlaybackError,
  playTrackSegment,
  stopPinClip,
} from '@/lib/spotifyPlayback';
import { supabase } from '@/lib/supabase';

const MIN_CLIP_SEC = 20;

export default function CreatePinScreen() {
  const c = useThemeColors();
  const params = useLocalSearchParams<{
    trackId: string;
    trackName: string;
    artistName: string;
    durationMs?: string;
    albumImageUrl?: string;
    previewUrl?: string;
    // Optional — passed in when entering this screen from the
    // long-press-on-map flow. Empty otherwise (Search-tab entry point).
    latitude?: string;
    longitude?: string;
  }>();

  const trackDurationMs = parseInt(params.durationMs ?? '0', 10);
  const trackDurationSec = Math.floor(trackDurationMs / 1000);

  const [latitude, setLatitude] = useState(params.latitude ?? '');
  const [longitude, setLongitude] = useState(params.longitude ?? '');
  const [placeName, setPlaceName] = useState('');
  const [startSeconds, setStartSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(
    trackDurationSec > 0 ? Math.min(MIN_CLIP_SEC, trackDurationSec) : MIN_CLIP_SEC,
  );
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  // Clip-preview playback (drives the user's Spotify to play the chosen
  // segment so they can hear it before saving).
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);
  const previewBlocked = useRef(false);
  const previewStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stop any preview audio when leaving this screen.
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
    setPreviewMsg(null);
    previewBlocked.current = false;
    setPreviewLoading(true);
    try {
      await playTrackSegment(params.trackId, startSeconds, durationSeconds);
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

  // On slider release, auto-play the new segment — unless a prior try
  // showed we can't (no device / not Premium), so we don't nag every drag.
  const onSliderRelease = () => {
    if (previewBlocked.current) return;
    playPreview();
  };

  // User-uploaded photo for this pin. `localPhotoUri` is what's shown
  // in the preview until we hit Save; on Save we upload and get back
  // the public URL we actually store on the pin.
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  const choosePhoto = async () => {
    try {
      setPickingPhoto(true);
      const uri = await pickImage();
      if (uri) setLocalPhotoUri(uri);
    } catch (e: any) {
      Alert.alert('Could not pick photo', e?.message ?? String(e));
    } finally {
      setPickingPhoto(false);
    }
  };

  const useCurrentLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLatitude(loc.coords.latitude.toString());
      setLongitude(loc.coords.longitude.toString());
    } catch (e: any) {
      Alert.alert('Could not get location', e?.message ?? String(e));
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
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

    try {
      await stopPreview();
      setSaving(true);

      // Upload the user photo first if they picked one. We do this
      // before the INSERT so the pin row references a stable URL.
      let uploadedUrl: string | null = null;
      if (localPhotoUri) {
        uploadedUrl = await uploadImage('pin', localPhotoUri);
      }

      const { error } = await supabase.rpc('create_pin', {
        p_latitude: lat,
        p_longitude: lng,
        p_place_name: placeName,
        p_spotify_track_id: params.trackId,
        p_track_name: params.trackName,
        p_artist_name: params.artistName,
        p_start_seconds: start,
        p_duration_seconds: dur,
        p_is_public: isPublic,
        p_preview_url: params.previewUrl ?? '',
        p_album_image_url: params.albumImageUrl ?? '',
        p_image_url: uploadedUrl ?? '',
      });

      if (error) throw error;
      router.back();
    } catch (e: any) {
      Alert.alert('Could not save pin', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

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
      <View style={[styles.trackCard, { backgroundColor: c.card }]}>
        {params.albumImageUrl ? (
          <Image source={{ uri: params.albumImageUrl }} style={styles.albumArt} />
        ) : (
          <View style={[styles.albumArt, { backgroundColor: c.card }]} />
        )}
        <View style={styles.trackText}>
          <Text style={styles.trackName} numberOfLines={2}>
            {params.trackName}
          </Text>
          <Text
            style={[styles.artist, { color: c.textMuted }]}
            numberOfLines={1}
          >
            {params.artistName}
          </Text>
          {trackDurationSec > 0 && (
            <Text style={[styles.trackDuration, { color: c.textSubtle }]}>
              Track: {Math.floor(trackDurationSec / 60)}:
              {(trackDurationSec % 60).toString().padStart(2, '0')}
            </Text>
          )}
        </View>
      </View>

      <Text style={styles.section}>Photo (optional)</Text>
      <Pressable
        style={[
          styles.photoBox,
          { backgroundColor: c.card, borderColor: c.border },
          pickingPhoto && styles.disabled,
        ]}
        onPress={choosePhoto}
        disabled={pickingPhoto}
      >
        {localPhotoUri ? (
          <Image source={{ uri: localPhotoUri }} style={styles.photoPreview} />
        ) : (
          <Text style={[styles.photoHint, { color: c.textMuted }]}>
            {pickingPhoto ? 'Opening…' : '+ Add a photo'}
          </Text>
        )}
      </Pressable>
      {localPhotoUri && (
        <Pressable onPress={() => setLocalPhotoUri(null)} hitSlop={8}>
          <Text style={[styles.photoClear, { color: c.textMuted }]}>
            Remove photo
          </Text>
        </Pressable>
      )}

      <Text style={styles.section}>Location</Text>
      <Pressable
        style={[
          styles.locButton,
          { backgroundColor: c.walkingActive },
          locating && styles.disabled,
        ]}
        onPress={useCurrentLocation}
        disabled={locating}
      >
        {locating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.locButtonText, { color: '#fff' }]}>
            Use my location
          </Text>
        )}
      </Pressable>

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={[styles.label, { color: c.textMuted }]}>Latitude</Text>
          <TextInput
            style={inputStyle}
            value={latitude}
            onChangeText={setLatitude}
            placeholder="40.34942"
            placeholderTextColor={c.placeholder}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.col}>
          <Text style={[styles.label, { color: c.textMuted }]}>Longitude</Text>
          <TextInput
            style={inputStyle}
            value={longitude}
            onChangeText={setLongitude}
            placeholder="-74.65691"
            placeholderTextColor={c.placeholder}
            keyboardType="numeric"
          />
        </View>
      </View>

      <Text style={[styles.label, { color: c.textMuted }]}>
        Place name (optional)
      </Text>
      <TextInput
        style={inputStyle}
        value={placeName}
        onChangeText={setPlaceName}
        placeholder="e.g. Firestone Library"
        placeholderTextColor={c.placeholder}
      />

      <Text style={styles.section}>Clip</Text>
      <Text style={[styles.hint, { color: c.textSubtle }]}>
        Drag to choose the part of the song that plays here — at least{' '}
        {MIN_CLIP_SEC}s.
      </Text>
      {trackDurationSec > 0 ? (
        <ClipRangeSlider
          totalSec={trackDurationSec}
          startSec={startSeconds}
          durationSec={durationSeconds}
          minDurationSec={MIN_CLIP_SEC}
          onChange={(s, d) => {
            setStartSeconds(s);
            setDurationSeconds(d);
          }}
          onPreview={onSliderRelease}
          isPlaying={previewPlaying}
          loadingPreview={previewLoading}
          onTogglePlay={togglePreview}
        />
      ) : (
        <Text style={[styles.hint, { color: c.textMuted }]}>
          Couldn't load the track length — this clip will start at 0s for{' '}
          {durationSeconds}s.
        </Text>
      )}
      {previewMsg && (
        <Text style={[styles.hint, { color: c.textMuted }]}>{previewMsg}</Text>
      )}

      <View style={[styles.row, styles.publicRow]}>
        <Text style={[styles.label, { color: c.textMuted }]}>
          Public (others can see)
        </Text>
        <Switch value={isPublic} onValueChange={setIsPublic} />
      </View>

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
            Save pin
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 4, paddingBottom: 64 },
  trackCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  albumArt: { width: 72, height: 72, borderRadius: 6 },
  trackText: { flex: 1, gap: 2 },
  trackName: { fontSize: 16, fontWeight: '600' },
  artist: { fontSize: 13 },
  trackDuration: { fontSize: 11, marginTop: 4 },

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
