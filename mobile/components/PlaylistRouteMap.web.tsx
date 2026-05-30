// Web stub for PlaylistRouteMap — react-native-maps doesn't run in
// the browser, so we render a plain-text placeholder.

import { StyleSheet } from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';
import type { PlaylistPin } from '@/lib/playlists';

type Props = {
  start: { latitude: number; longitude: number } | null;
  orderedPins: PlaylistPin[];
  primaryColor: string;
};

export default function PlaylistRouteMap({ orderedPins }: Props) {
  const c = useThemeColors();
  return (
    <View style={[styles.placeholder, { backgroundColor: c.card }]}>
      <Text style={[styles.text, { color: c.textMuted }]}>
        Map preview is iOS/Android-only. Route order: {orderedPins.length} pin
        {orderedPins.length === 1 ? '' : 's'}.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  text: { fontSize: 13, textAlign: 'center' },
});
