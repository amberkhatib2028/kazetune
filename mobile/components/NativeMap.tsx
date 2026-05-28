// Native (iOS/Android) map view.
// Loads pins from Supabase, renders them as markers, and provides a
// Walking Mode toggle that auto-plays clips as the user enters
// geofences around each pin.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { playPinClip, stopPinClip } from '@/lib/audio';
import { startWalking, type WalkingHandle } from '@/lib/geofencing';
import { listPins, type Pin } from '@/lib/pins';

const FALLBACK_REGION = {
  latitude: 40.34942,
  longitude: -74.65691,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export default function NativeMap() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [walking, setWalking] = useState(false);
  const walkingHandle = useRef<WalkingHandle | null>(null);
  const [nowPlaying, setNowPlaying] = useState<Pin | null>(null);
  const [walkingMsg, setWalkingMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setPins(await listPins());
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load pins');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Stop walking + audio when this screen unmounts.
  useEffect(() => () => {
    walkingHandle.current?.stop();
    walkingHandle.current = null;
    stopPinClip();
  }, []);

  const toggleWalking = async () => {
    if (walking) {
      walkingHandle.current?.stop();
      walkingHandle.current = null;
      await stopPinClip();
      setWalking(false);
      setNowPlaying(null);
      setWalkingMsg(null);
      return;
    }
    if (pins.length === 0) {
      setWalkingMsg('No pins to walk to. Place one first.');
      return;
    }
    try {
      setWalkingMsg(null);
      const handle = await startWalking({
        pins,
        onEnter: async (pin) => {
          const played = await playPinClip(pin);
          setNowPlaying(played ? pin : null);
          setWalkingMsg(
            played
              ? null
              : `No preview audio for "${pin.track_name}"`,
          );
        },
        onExit: (pin) => {
          setNowPlaying((cur) => (cur?.id === pin.id ? null : cur));
        },
        onError: (msg) => setWalkingMsg(msg),
      });
      walkingHandle.current = handle;
      setWalking(true);
    } catch (e: any) {
      setWalkingMsg(e?.message ?? String(e));
    }
  };

  const initialRegion =
    pins.length > 0
      ? {
          latitude: pins[0].latitude,
          longitude: pins[0].longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }
      : FALLBACK_REGION;

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={initialRegion}>
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            title={pin.place_name ?? pin.track_name}
            description={`${pin.track_name} — ${pin.artist_name}`}
            pinColor={pin.is_mine ? '#1DB954' : '#FF3B30'}
            onCalloutPress={() =>
              router.push({ pathname: '/pin-detail', params: { id: pin.id } })
            }
          />
        ))}
      </MapView>

      {/* Walking-mode toggle */}
      <View style={styles.toggleWrap}>
        <Pressable
          style={[
            styles.toggleBtn,
            walking ? styles.toggleBtnOn : styles.toggleBtnOff,
          ]}
          onPress={toggleWalking}
          disabled={loading}
        >
          <Text style={styles.toggleBtnText}>
            {walking ? 'Stop walking' : 'Start walking'}
          </Text>
        </Pressable>
        {walkingMsg && <Text style={styles.msg}>{walkingMsg}</Text>}
      </View>

      {/* Now-playing banner */}
      {nowPlaying && (
        <View style={styles.nowPlaying}>
          <Text style={styles.nowPlayingTitle} numberOfLines={1}>
            ▶ {nowPlaying.track_name}
          </Text>
          <Text style={styles.nowPlayingSubtitle} numberOfLines={1}>
            {nowPlaying.artist_name} · {nowPlaying.place_name ?? 'pin'}
          </Text>
        </View>
      )}

      {loading && (
        <View style={styles.spinnerCorner} pointerEvents="none">
          <ActivityIndicator />
        </View>
      )}
      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },

  toggleWrap: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    alignItems: 'flex-start',
    gap: 8,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  toggleBtnOff: { backgroundColor: '#1DB954' },
  toggleBtnOn: { backgroundColor: '#222' },
  toggleBtnText: { color: 'white', fontWeight: '700' },
  msg: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 8,
    borderRadius: 6,
    fontSize: 12,
  },

  nowPlaying: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(20,20,20,0.92)',
    padding: 12,
    borderRadius: 12,
  },
  nowPlayingTitle: { color: 'white', fontWeight: '700', fontSize: 14 },
  nowPlayingSubtitle: { color: '#bbb', fontSize: 12, marginTop: 2 },

  spinnerCorner: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 8,
    borderRadius: 8,
  },
  errorBar: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: '#c00',
    padding: 12,
    borderRadius: 8,
  },
  errorText: { color: 'white' },
});
