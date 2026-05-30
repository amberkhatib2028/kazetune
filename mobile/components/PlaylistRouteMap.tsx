// MapView for the playlist-route modal.
//
// Draws a coral pink polyline through the pins in route order, with
// numbered coral markers (1, 2, 3...) on each stop. If we have the
// user's current location, the polyline starts from there and the
// user's blue dot is visible via showsUserLocation.
//
// Extracted from the screen so we can ship a .web.tsx stub —
// react-native-maps blows up the web bundle on import.

import { StyleSheet, View as RNView } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { Text } from '@/components/Themed';
import type { PlaylistPin } from '@/lib/playlists';

type Props = {
  start: { latitude: number; longitude: number } | null;
  orderedPins: PlaylistPin[];
  primaryColor: string;
};

export default function PlaylistRouteMap({
  start,
  orderedPins,
  primaryColor,
}: Props) {
  const polylineCoords = [
    ...(start ? [{ latitude: start.latitude, longitude: start.longitude }] : []),
    ...orderedPins.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    })),
  ];

  // Bounding box around everything we're drawing → initial region.
  const lats = polylineCoords.map((p) => p.latitude);
  const lngs = polylineCoords.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const initialRegion = {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.005, (maxLat - minLat) * 1.6),
    longitudeDelta: Math.max(0.005, (maxLng - minLng) * 1.6),
  };

  return (
    <MapView
      style={StyleSheet.absoluteFillObject}
      initialRegion={initialRegion}
      showsUserLocation
      showsMyLocationButton={false}
    >
      {polylineCoords.length >= 2 && (
        <Polyline
          coordinates={polylineCoords}
          strokeColor={primaryColor}
          strokeWidth={4}
        />
      )}
      {orderedPins.map((p, idx) => (
        <Marker
          key={p.id}
          coordinate={{ latitude: p.latitude, longitude: p.longitude }}
          title={`${idx + 1}. ${p.track_name}`}
          description={p.artist_name}
        >
          <RNView
            style={[
              styles.numberMarker,
              { backgroundColor: primaryColor },
            ]}
          >
            <Text style={styles.numberText}>{idx + 1}</Text>
          </RNView>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  numberMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  numberText: { color: 'white', fontWeight: '800', fontSize: 14 },
});
