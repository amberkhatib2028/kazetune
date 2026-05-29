// Modal screen — fill in location + clip details for a Spotify track
// the user picked from the Search tab, then INSERT via the create_pin
// RPC (handles the geography type + auth.uid() server-side).

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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

import { Text, View, useThemeColors } from '@/components/Themed';
import { pickImage, uploadImage } from '@/lib/images';
import { supabase } from '@/lib/supabase';

export default function CreatePinScreen() {
  const c = useThemeColors();
  const params = useLocalSearchParams<{
    trackId: string;
    trackName: string;
    artistName: string;
    durationMs?: string;
    albumImageUrl?: string;
    previewUrl?: string;
  }>();

  const trackDurationMs = parseInt(params.durationMs ?? '0', 10);
  const trackDurationSec = Math.floor(trackDurationMs / 1000);

  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [startSeconds, setStartSeconds] = useState('0');
  const [durationSeconds, setDurationSeconds] = useState('20');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

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
    const start = parseInt(startSeconds, 10);
    const dur = parseInt(durationSeconds, 10);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      Alert.alert('Invalid location', 'Latitude and longitude must be numbers.');
      return;
    }
    if (Number.isNaN(start) || start < 0) {
      Alert.alert('Invalid start', 'Start seconds must be 0 or greater.');
      return;
    }
    if (Number.isNaN(dur) || dur < 20) {
      Alert.alert('Invalid duration', 'Clip must be at least 20 seconds.');
      return;
    }
    if (trackDurationSec > 0 && start + dur > trackDurationSec) {
      Alert.alert(
        'Clip exceeds track length',
        `start (${start}s) + duration (${dur}s) > track length (${trackDurationSec}s).`,
      );
      return;
    }

    try {
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
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={[styles.label, { color: c.textMuted }]}>
            Start at (sec)
          </Text>
          <TextInput
            style={inputStyle}
            value={startSeconds}
            onChangeText={setStartSeconds}
            placeholder="0"
            placeholderTextColor={c.placeholder}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.col}>
          <Text style={[styles.label, { color: c.textMuted }]}>
            Duration (sec)
          </Text>
          <TextInput
            style={inputStyle}
            value={durationSeconds}
            onChangeText={setDurationSeconds}
            placeholder="20"
            placeholderTextColor={c.placeholder}
            keyboardType="number-pad"
          />
        </View>
      </View>
      <Text style={[styles.hint, { color: c.textSubtle }]}>
        Clip must be at least 20 seconds.
      </Text>

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
