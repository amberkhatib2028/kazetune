// Web stub for the walk-summary map. react-native-maps doesn't run in
// the browser, so we render a plain-text placeholder. Web users never
// reach the walk-summary screen anyway (walking is a phone feature).

import { StyleSheet } from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';
import type { Pin } from '@/lib/pins';

type Props = {
  path: { latitude: number; longitude: number }[];
  pins: Pin[];
  primaryColor: string;
  initialRegion: unknown;
};

export default function WalkSummaryMap({ path, pins }: Props) {
  const c = useThemeColors();
  return (
    <View style={[styles.placeholder, { backgroundColor: c.card }]}>
      <Text style={[styles.text, { color: c.textMuted }]}>
        Map preview is iOS/Android-only. {path.length} path point
        {path.length === 1 ? '' : 's'} · {pins.length} pin
        {pins.length === 1 ? '' : 's'} collected.
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
