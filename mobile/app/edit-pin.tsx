// Edit Pin modal — opened from the Pin Detail screen via the Edit
// button. Lets the owner change place name, location, clip start /
// duration, public/private, and the user-uploaded photo. The
// underlying Spotify track is fixed (delete + recreate to change it).

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View as RNView,
} from 'react-native';
import * as Location from 'expo-location';

import { Text, View, useThemeColors } from '@/components/Themed';
import { pickImage, uploadImage } from '@/lib/images';
import { listPins, updatePin, type Pin } from '@/lib/pins';

export default function EditPinScreen() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [pin, setPin] = useState<Pin | null>(null);
  const [loading, setLoading] = useState(true);

  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [startSeconds, setStartSeconds] = useState('0');
  const [durationSeconds, setDurationSeconds] = useState('20');
  const [isPublic, setIsPublic] = useState(false);

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
  const [locating, setLocating] = useState(false);
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
      setStartSeconds(found.start_seconds.toString());
      setDurationSeconds(found.duration_seconds.toString());
      setIsPublic(found.is_public);
      setExistingImageUrl(found.image_url);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

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
    if (!pin) return;
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

    try {
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
        isPublic,
        imageUrl: finalImageUrl,
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
  const photoPreviewUri =
    localPhotoUri ??
    (!removeExistingPhoto && existingImageUrl ? existingImageUrl : null);

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
        {photoPreviewUri ? (
          <Image source={{ uri: photoPreviewUri }} style={styles.photoPreview} />
        ) : (
          <Text style={[styles.photoHint, { color: c.textMuted }]}>
            {pickingPhoto ? 'Opening…' : '+ Add a photo'}
          </Text>
        )}
      </Pressable>
      {photoPreviewUri && (
        <Pressable onPress={removePhoto} hitSlop={8}>
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

      <RNView style={styles.row}>
        <RNView style={styles.col}>
          <Text style={[styles.label, { color: c.textMuted }]}>Latitude</Text>
          <TextInput
            style={inputStyle}
            value={latitude}
            onChangeText={setLatitude}
            placeholder="40.34942"
            placeholderTextColor={c.placeholder}
            keyboardType="numeric"
          />
        </RNView>
        <RNView style={styles.col}>
          <Text style={[styles.label, { color: c.textMuted }]}>Longitude</Text>
          <TextInput
            style={inputStyle}
            value={longitude}
            onChangeText={setLongitude}
            placeholder="-74.65691"
            placeholderTextColor={c.placeholder}
            keyboardType="numeric"
          />
        </RNView>
      </RNView>

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
      <RNView style={styles.row}>
        <RNView style={styles.col}>
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
        </RNView>
        <RNView style={styles.col}>
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
        </RNView>
      </RNView>
      <Text style={[styles.hint, { color: c.textSubtle }]}>
        Clip must be at least 20 seconds.
      </Text>

      <RNView style={[styles.row, styles.publicRow]}>
        <Text style={[styles.label, { color: c.textMuted }]}>
          Public (others can see)
        </Text>
        <Switch value={isPublic} onValueChange={setIsPublic} />
      </RNView>

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
