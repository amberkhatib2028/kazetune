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

import { Text, View } from '@/components/Themed';
import { supabase } from '@/lib/supabase';

export default function CreatePinScreen() {
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
      });

      if (error) throw error;
      router.back();
    } catch (e: any) {
      Alert.alert('Could not save pin', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* --- Track preview (read-only) --- */}
      <View style={styles.trackCard}>
        {params.albumImageUrl ? (
          <Image source={{ uri: params.albumImageUrl }} style={styles.albumArt} />
        ) : (
          <View style={[styles.albumArt, styles.albumArtFallback]} />
        )}
        <View style={styles.trackText}>
          <Text style={styles.trackName} numberOfLines={2}>
            {params.trackName}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {params.artistName}
          </Text>
          {trackDurationSec > 0 && (
            <Text style={styles.trackDuration}>
              Track: {Math.floor(trackDurationSec / 60)}:
              {(trackDurationSec % 60).toString().padStart(2, '0')}
            </Text>
          )}
        </View>
      </View>

      {/* --- Location --- */}
      <Text style={styles.section}>Location</Text>
      <Pressable
        style={[styles.locButton, locating && styles.disabled]}
        onPress={useCurrentLocation}
        disabled={locating}
      >
        {locating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.locButtonText}>Use my location</Text>
        )}
      </Pressable>

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Latitude</Text>
          <TextInput
            style={styles.input}
            value={latitude}
            onChangeText={setLatitude}
            placeholder="40.34942"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Longitude</Text>
          <TextInput
            style={styles.input}
            value={longitude}
            onChangeText={setLongitude}
            placeholder="-74.65691"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>
      </View>

      <Text style={styles.label}>Place name (optional)</Text>
      <TextInput
        style={styles.input}
        value={placeName}
        onChangeText={setPlaceName}
        placeholder="e.g. Firestone Library"
        placeholderTextColor="#999"
      />

      {/* --- Clip --- */}
      <Text style={styles.section}>Clip</Text>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Start at (sec)</Text>
          <TextInput
            style={styles.input}
            value={startSeconds}
            onChangeText={setStartSeconds}
            placeholder="0"
            placeholderTextColor="#999"
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Duration (sec)</Text>
          <TextInput
            style={styles.input}
            value={durationSeconds}
            onChangeText={setDurationSeconds}
            placeholder="20"
            placeholderTextColor="#999"
            keyboardType="number-pad"
          />
        </View>
      </View>
      <Text style={styles.hint}>Clip must be at least 20 seconds.</Text>

      {/* --- Public --- */}
      <View style={[styles.row, styles.publicRow]}>
        <Text style={styles.label}>Public (others can see)</Text>
        <Switch value={isPublic} onValueChange={setIsPublic} />
      </View>

      {/* --- Save --- */}
      <Pressable
        style={[styles.saveButton, saving && styles.disabled]}
        onPress={save}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save pin</Text>
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
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    marginBottom: 16,
  },
  albumArt: { width: 72, height: 72, borderRadius: 6, backgroundColor: '#ddd' },
  albumArtFallback: { backgroundColor: '#ccc' },
  trackText: { flex: 1, gap: 2 },
  trackName: { fontSize: 16, fontWeight: '600' },
  artist: { fontSize: 13, opacity: 0.7 },
  trackDuration: { fontSize: 11, opacity: 0.5, marginTop: 4 },

  section: { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
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
  hint: { fontSize: 12, opacity: 0.5, marginTop: 4 },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  publicRow: { alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },

  locButton: {
    backgroundColor: '#222',
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 8,
  },
  locButtonText: { color: 'white', fontWeight: '600' },

  saveButton: {
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonText: { color: 'white', fontWeight: '700', fontSize: 16 },

  disabled: { opacity: 0.6 },
});
