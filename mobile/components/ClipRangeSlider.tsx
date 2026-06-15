// ClipRangeSlider — an Instagram-style audio scrubber for picking which
// part of a song a pin uses. The user drags a highlighted window over a
// waveform to set the clip's start and length; on release the parent can
// play that exact segment (full-track Spotify seek) so they hear it.
//
// Replaces the old "type the seconds" inputs. Built on PanResponder so
// it needs no extra gesture library.
//
// Geometry: the full bar spans [0, totalSec]. The window is [start,
// start+duration]. Three drag zones:
//   • body         → move the whole window (changes start, keeps length)
//   • left handle  → move start, keep the END fixed (changes length)
//   • right handle → move the end (changes length, keeps start)

import { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  View as RNView,
} from 'react-native';

import { Text, useThemeColors } from './Themed';

const HANDLE_W = 18;
const BAR_HEIGHT = 64;
const WAVE_BARS = 42;

function fmt(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

type Props = {
  /** Full length of the track, in seconds. */
  totalSec: number;
  startSec: number;
  durationSec: number;
  minDurationSec?: number;
  maxDurationSec?: number;
  /** Fired continuously while dragging — keep the parent's state in sync. */
  onChange: (startSec: number, durationSec: number) => void;
  /** Fired once on release — a good moment to play the chosen segment. */
  onPreview?: (startSec: number, durationSec: number) => void;
  /** Optional play/stop control rendered under the bar. */
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  loadingPreview?: boolean;
};

export default function ClipRangeSlider({
  totalSec,
  startSec,
  durationSec,
  minDurationSec = 20,
  maxDurationSec,
  onChange,
  onPreview,
  isPlaying,
  onTogglePlay,
  loadingPreview,
}: Props) {
  const c = useThemeColors();
  const [width, setWidth] = useState(0);

  // The track might be shorter than the requested minimum; never let the
  // min exceed what's available.
  const total = Math.max(totalSec, 1);
  const minDur = Math.min(minDurationSec, total);
  const maxDur = Math.min(maxDurationSec ?? total, total);

  // Decorative, stable waveform heights (0.25–1.0).
  const waveHeights = useMemo(
    () => Array.from({ length: WAVE_BARS }, (_, i) =>
      0.25 + (Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)) * 0.75)),
    [],
  );

  // Refs read inside PanResponder callbacks (created once, so they'd
  // otherwise capture stale values).
  const widthRef = useRef(0);
  widthRef.current = width;
  const totalRef = useRef(total);
  totalRef.current = total;
  const minRef = useRef(minDur);
  minRef.current = minDur;
  const maxRef = useRef(maxDur);
  maxRef.current = maxDur;
  const valsRef = useRef({ start: startSec, duration: durationSec });
  valsRef.current = { start: startSec, duration: durationSec };
  const cbRef = useRef({ onChange, onPreview });
  cbRef.current = { onChange, onPreview };

  // Snapshot of start/duration at gesture start.
  const grant = useRef({ start: 0, duration: 0 });

  const secPerPx = () => totalRef.current / (widthRef.current || 1);

  const makeResponder = (
    move: (dSec: number, g0: { start: number; duration: number }) => {
      start: number;
      duration: number;
    },
  ) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        grant.current = { ...valsRef.current };
      },
      onPanResponderMove: (_evt, gs) => {
        const next = move(gs.dx * secPerPx(), grant.current);
        cbRef.current.onChange(Math.round(next.start), Math.round(next.duration));
      },
      onPanResponderRelease: () => {
        const { start, duration } = valsRef.current;
        cbRef.current.onPreview?.(Math.round(start), Math.round(duration));
      },
    });

  const bodyPan = useRef(
    makeResponder((dSec, g0) => {
      const t = totalRef.current;
      const start = Math.max(0, Math.min(g0.start + dSec, t - g0.duration));
      return { start, duration: g0.duration };
    }),
  ).current;

  const leftPan = useRef(
    makeResponder((dSec, g0) => {
      const end = g0.start + g0.duration; // hold the end fixed
      // Clamp start so the clip is between min and max seconds long.
      const start = Math.max(
        0,
        Math.max(end - maxRef.current, Math.min(g0.start + dSec, end - minRef.current)),
      );
      return { start, duration: end - start };
    }),
  ).current;

  const rightPan = useRef(
    makeResponder((dSec, g0) => {
      const t = totalRef.current;
      // Clamp end so the clip is between min and max seconds long.
      const end = Math.min(
        g0.start + maxRef.current,
        Math.max(g0.start + minRef.current, Math.min(g0.start + g0.duration + dSec, t)),
      );
      return { start: g0.start, duration: end - g0.start };
    }),
  ).current;

  // Pixel geometry of the window.
  const left = (startSec / total) * width;
  const winW = (durationSec / total) * width;

  return (
    <RNView style={styles.wrap}>
      <RNView
        style={[styles.bar, { backgroundColor: c.card, height: BAR_HEIGHT }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {/* Decorative waveform behind everything. */}
        <RNView style={styles.wave} pointerEvents="none">
          {waveHeights.map((h, i) => (
            <RNView
              key={i}
              style={{
                width: 3,
                height: h * (BAR_HEIGHT - 16),
                borderRadius: 2,
                backgroundColor: c.textSubtle,
                opacity: 0.5,
              }}
            />
          ))}
        </RNView>

        {width > 0 && (
          <>
            {/* The selected window (draggable body). */}
            <RNView
              {...bodyPan.panHandlers}
              style={[
                styles.window,
                {
                  left,
                  width: winW,
                  borderColor: c.primary,
                  backgroundColor: c.primary + '33', // ~20% alpha
                },
              ]}
            />
            {/* Resize handles. */}
            <RNView
              {...leftPan.panHandlers}
              style={[styles.handle, { left: left - HANDLE_W / 2, backgroundColor: c.primary }]}
            >
              <RNView style={styles.grip} />
            </RNView>
            <RNView
              {...rightPan.panHandlers}
              style={[
                styles.handle,
                { left: left + winW - HANDLE_W / 2, backgroundColor: c.primary },
              ]}
            >
              <RNView style={styles.grip} />
            </RNView>
          </>
        )}
      </RNView>

      <RNView style={styles.labels}>
        <Text style={[styles.time, { color: c.text }]}>
          {fmt(startSec)} – {fmt(startSec + durationSec)}
        </Text>
        <Text style={[styles.dur, { color: c.textMuted }]}>
          {Math.round(durationSec)}s clip
        </Text>
      </RNView>

      {onTogglePlay && (
        <Pressable
          style={[styles.playBtn, { backgroundColor: c.primary }, loadingPreview && styles.disabled]}
          onPress={onTogglePlay}
          disabled={loadingPreview}
        >
          <Text style={[styles.playBtnText, { color: c.primaryText }]}>
            {loadingPreview ? 'Loading…' : isPlaying ? '■ Stop' : '▶ Listen to this part'}
          </Text>
        </Pressable>
      )}
    </RNView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 8 },
  bar: {
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
  },
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
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: HANDLE_W,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: {
    width: 3,
    height: 22,
    borderRadius: 2,
    backgroundColor: '#fff',
    opacity: 0.9,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: { fontSize: 15, fontWeight: '600' },
  dur: { fontSize: 13 },
  playBtn: {
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 2,
  },
  playBtnText: { fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.6 },
});
