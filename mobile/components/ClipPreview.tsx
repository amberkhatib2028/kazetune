// ClipPreview — a read-only visual of where a pin's clip sits inside the
// full song: a little waveform with the selected window highlighted.
// Same look as ClipRangeSlider, minus the gestures. Used on pin detail.

import { useMemo, useState } from 'react';
import { StyleSheet, View as RNView, type LayoutChangeEvent } from 'react-native';

import { Text, useThemeColors } from './Themed';

const WAVE_BARS = 42;
const BAR_HEIGHT = 56;

function fmt(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export function ClipPreview({
  totalSec,
  startSec,
  durationSec,
}: {
  totalSec: number;
  startSec: number;
  durationSec: number;
}) {
  const c = useThemeColors();
  const [width, setWidth] = useState(0);
  const total = Math.max(totalSec, 1);

  const waveHeights = useMemo(
    () =>
      Array.from({ length: WAVE_BARS }, (_, i) =>
        0.25 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)) * 0.75,
      ),
    [],
  );

  const left = (Math.max(0, startSec) / total) * width;
  const winW = (Math.min(durationSec, total) / total) * width;

  return (
    <RNView style={styles.wrap}>
      <RNView
        style={[styles.bar, { backgroundColor: c.card, height: BAR_HEIGHT }]}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      >
        <RNView style={styles.wave} pointerEvents="none">
          {waveHeights.map((h, i) => (
            <RNView
              key={i}
              style={{
                width: 3,
                height: h * (BAR_HEIGHT - 14),
                borderRadius: 2,
                backgroundColor: c.textSubtle,
                opacity: 0.5,
              }}
            />
          ))}
        </RNView>
        {width > 0 && (
          <RNView
            style={[
              styles.window,
              { left, width: winW, borderColor: c.primary, backgroundColor: c.primary + '33' },
            ]}
          />
        )}
      </RNView>
      <RNView style={styles.labels}>
        <Text style={[styles.time, { color: c.text }]}>
          {fmt(startSec)} – {fmt(startSec + durationSec)}
        </Text>
        <Text style={[styles.dur, { color: c.textMuted }]}>
          {Math.round(durationSec)}s
        </Text>
      </RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 6 },
  bar: { borderRadius: 12, overflow: 'hidden', justifyContent: 'center' },
  wave: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  window: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderWidth: 2,
    borderRadius: 10,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { fontSize: 14, fontWeight: '600' },
  dur: { fontSize: 13 },
});
