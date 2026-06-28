// Custom map marker that shows the pin's photo (or album art, or a
// letter fallback) inside a circular ring. Used on the Map tab and
// inside the post-walk summary modal.
//
// `tracksViewChanges` quirk: react-native-maps re-renders the marker
// view on every map pan/zoom while it's true. That's needed for the
// initial paint (otherwise an async Image source shows blank), so we
// keep it true until the Image fires onLoad, then flip to false to
// stop the constant re-renders. Without this you'd see janky frame
// drops on maps with many pins.

import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { Text, useThemeColors } from '@/components/Themed';
import type { Pin } from '@/lib/pins';

type Props = {
  pin: Pin;
  /** Deprecated — colors now come from the theme. Kept optional so
   *  existing callers don't break. */
  primaryColor?: string;
  onCalloutPress?: () => void;
};

export default function PinMarker({ pin, onCalloutPress }: Props) {
  const c = useThemeColors();
  const imageUrl = pin.image_url ?? pin.album_image_url ?? null;
  // Yours = warm sunset pink, everyone else = cool teal.
  const ringColor = pin.is_mine ? c.pinMine : c.pinOther;
  const [tracking, setTracking] = useState(true);

  // For the letter-fallback path there's no Image to listen on, so
  // schedule a one-shot timer to stop tracking after the first frame.
  useEffect(() => {
    if (!imageUrl) {
      const t = setTimeout(() => setTracking(false), 100);
      return () => clearTimeout(t);
    }
  }, [imageUrl]);

  return (
    <Marker
      coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
      title={pin.place_name ?? pin.track_name}
      description={`${pin.track_name}—${pin.artist_name}`}
      tracksViewChanges={tracking}
      onCalloutPress={onCalloutPress}
    >
      <View style={[styles.wrap, { borderColor: ringColor }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.img}
            onLoad={() => {
              // Give RN one extra frame to commit the image before we
              // freeze the view tree, otherwise we sometimes freeze a
              // half-rendered placeholder.
              setTimeout(() => setTracking(false), 50);
            }}
          />
        ) : (
          <View style={[styles.letterBg, { backgroundColor: ringColor }]}>
            <Text style={styles.letter}>
              {pin.track_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    backgroundColor: 'white',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 3,
  },
  img: { width: '100%', height: '100%' },
  letterBg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  letter: { color: 'white', fontWeight: '800', fontSize: 16 },
});
