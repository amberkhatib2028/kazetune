// Native (iOS/Android) map view.
// Loads every visible pin and renders markers; supports walking mode
// over the global pin set.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

import { useThemeColors } from '@/components/Themed';
import { listPins, type Pin } from '@/lib/pins';
import { useWalkingMode } from '@/lib/useWalkingMode';

const FALLBACK_REGION = {
  latitude: 40.34942,
  longitude: -74.65691,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export default function NativeMap() {
  const c = useThemeColors();
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  // Only auto-fit on the first non-empty pin list. After that the
  // user's zoom/pan is theirs to keep.
  const hasFitOnce = useRef(false);

  const { walking, nowPlaying, message: walkingMsg, toggle } = useWalkingMode(pins);

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

  const recenterOnMe = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'Grant location access so the map can show where you are.',
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500,
      );
    } catch (e: any) {
      Alert.alert('Could not get location', e?.message ?? String(e));
    }
  }, []);

  useEffect(() => {
    if (hasFitOnce.current) return;
    if (pins.length === 0 || !mapRef.current) return;
    mapRef.current.fitToCoordinates(
      pins.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
      {
        edgePadding: { top: 100, right: 60, bottom: 120, left: 60 },
        animated: true,
      },
    );
    hasFitOnce.current = true;
  }, [pins]);

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
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            title={pin.place_name ?? pin.track_name}
            description={`${pin.track_name} — ${pin.artist_name}`}
            pinColor={pin.is_mine ? c.primary : '#FF3B30'}
            onCalloutPress={() =>
              router.push({ pathname: '/pin-detail', params: { id: pin.id } })
            }
          />
        ))}
      </MapView>

      <View style={styles.toggleWrap}>
        <Pressable
          style={[
            styles.toggleBtn,
            { backgroundColor: walking ? c.walkingActive : c.primary },
          ]}
          onPress={toggle}
          disabled={loading}
        >
          <Text style={[styles.toggleBtnText, { color: c.primaryText }]}>
            {walking ? 'Stop walking' : 'Start walking'}
          </Text>
        </Pressable>
        {walkingMsg && (
          <Text
            style={[
              styles.msg,
              { backgroundColor: c.overlay, color: c.overlayText },
            ]}
          >
            {walkingMsg}
          </Text>
        )}
      </View>

      <Pressable
        style={[
          styles.recenterBtn,
          { backgroundColor: c.background },
          nowPlaying && styles.recenterBtnLifted,
        ]}
        onPress={recenterOnMe}
        hitSlop={8}
      >
        <Text style={[styles.recenterBtnText, { color: c.primary }]}>◎</Text>
      </Pressable>

      {nowPlaying && (
        <View style={[styles.nowPlaying, { backgroundColor: c.overlay }]}>
          <Text
            style={[styles.nowPlayingTitle, { color: c.overlayText }]}
            numberOfLines={1}
          >
            ▶ {nowPlaying.track_name}
          </Text>
          <Text
            style={[styles.nowPlayingSubtitle, { color: c.overlaySubtext }]}
            numberOfLines={1}
          >
            {nowPlaying.artist_name} · {nowPlaying.place_name ?? 'pin'}
          </Text>
        </View>
      )}

      {loading && (
        <View
          style={[styles.spinnerCorner, { backgroundColor: c.card }]}
          pointerEvents="none"
        >
          <ActivityIndicator color={c.text} />
        </View>
      )}
      {error && (
        <View style={[styles.errorBar, { backgroundColor: c.danger }]}>
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
  toggleBtnText: { fontWeight: '700' },
  msg: {
    padding: 8,
    borderRadius: 6,
    fontSize: 12,
    overflow: 'hidden',
  },

  recenterBtn: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 5,
  },
  // Lift the button above the now-playing banner so it doesn't overlap.
  recenterBtnLifted: { bottom: 96 },
  recenterBtnText: { fontSize: 22, fontWeight: '700' },

  nowPlaying: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 12,
  },
  nowPlayingTitle: { fontWeight: '700', fontSize: 14 },
  nowPlayingSubtitle: { fontSize: 12, marginTop: 2 },

  spinnerCorner: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    borderRadius: 8,
  },
  errorBar: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
  },
  errorText: { color: 'white' },
});
