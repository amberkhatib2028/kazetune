// The MapView + Polyline + Markers block used inside the walk-summary
// screen. Extracted so we can ship a web fallback (.web.tsx) without
// react-native-maps blowing up the web bundle on import.

import { StyleSheet } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';

import PinMarker from '@/components/PinMarker';
import type { Pin } from '@/lib/pins';

type Props = {
  path: { latitude: number; longitude: number }[];
  pins: Pin[];
  primaryColor: string;
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
};

export default function WalkSummaryMap({
  path,
  pins,
  primaryColor,
  initialRegion,
}: Props) {
  return (
    <MapView
      style={StyleSheet.absoluteFillObject}
      initialRegion={initialRegion}
    >
      {path.length >= 2 && (
        <Polyline
          coordinates={path}
          strokeColor={primaryColor}
          strokeWidth={4}
        />
      )}
      {pins.map((p) => (
        <PinMarker key={p.id} pin={p} primaryColor={primaryColor} />
      ))}
    </MapView>
  );
}
