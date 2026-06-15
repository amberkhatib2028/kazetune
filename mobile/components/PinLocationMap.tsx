// PinLocationMap — pick a pin's location by dragging the map under a
// fixed center pin (no typing lat/long). Reports the map's center via
// onChange as the user pans. Used on create-pin / edit-pin.

import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View as RNView } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';

import { Text, useThemeColors } from './Themed';
import { useResolvedScheme } from '@/lib/themePreference';

const FALLBACK = {
  latitude: 40.34942,
  longitude: -74.65691,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

export function PinLocationMap({
  initialLat,
  initialLng,
  onChange,
}: {
  initialLat?: number | null;
  initialLng?: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const c = useThemeColors();
  const scheme = useResolvedScheme();
  const mapRef = useRef<MapView>(null);

  const hasInitial = initialLat != null && initialLng != null;
  const initial = hasInitial
    ? { latitude: initialLat!, longitude: initialLng!, latitudeDelta: 0.012, longitudeDelta: 0.012 }
    : FALLBACK;

  useEffect(() => {
    if (hasInitial) {
      onChange(initialLat!, initialLng!);
      return;
    }
    // No starting point — center on the user.
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          onChange(FALLBACK.latitude, FALLBACK.longitude);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        mapRef.current?.animateToRegion(
          {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          },
          400,
        );
        onChange(loc.coords.latitude, loc.coords.longitude);
      } catch {
        onChange(FALLBACK.latitude, FALLBACK.longitude);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recenter = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        400,
      );
    } catch {
      // ignore
    }
  };

  return (
    <RNView style={styles.wrap}>
      <RNView style={styles.mapBox}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={initial}
          userInterfaceStyle={scheme}
          showsUserLocation
          onRegionChangeComplete={(r) => onChange(r.latitude, r.longitude)}
        />
        <RNView style={styles.centerPin} pointerEvents="none">
          <SymbolView name="mappin.circle.fill" tintColor={c.primary} size={42} />
        </RNView>
        <Pressable
          style={[styles.recenter, { backgroundColor: c.background }]}
          onPress={recenter}
          hitSlop={8}
        >
          <Text style={[styles.recenterText, { color: c.primary }]}>◎</Text>
        </Pressable>
      </RNView>
      <Text style={[styles.hint, { color: c.textSubtle }]}>
        Drag the map to place your pin
      </Text>
    </RNView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginTop: 4 },
  mapBox: { height: 220, borderRadius: 14, overflow: 'hidden' },
  centerPin: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenter: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  recenterText: { fontSize: 20, fontWeight: '700' },
  hint: { fontSize: 12, textAlign: 'center' },
});
