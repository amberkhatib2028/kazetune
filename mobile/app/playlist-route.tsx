// Playlist route modal — "show me the most efficient way to walk
// through all the pins in this playlist."
//
// Loads the playlist's pins, asks the OS for the user's current
// location (best-effort; falls back to starting from the first pin if
// denied), then runs nearest-neighbor TSP + 2-opt to pick a stop
// order. Displays the route on a MapView with numbered markers and a
// scrollable ordered list below.

import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  View as RNView,
} from 'react-native';
import * as Location from 'expo-location';

import PlaylistRouteMap from '@/components/PlaylistRouteMap';
import { Text, View, useThemeColors } from '@/components/Themed';
import { listPlaylistPins, type PlaylistPin } from '@/lib/playlists';
import { computeRoute } from '@/lib/route';
import { formatDistance } from '@/lib/walkRecorder';

// ~5 km/h — a relaxed walking pace. 1 km ≈ 12 minutes.
const WALKING_METERS_PER_MINUTE = 83;

export default function PlaylistRouteScreen() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [pins, setPins] = useState<PlaylistPin[] | null>(null);
  const [startPoint, setStartPoint] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load pins + user location in parallel.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ps = await listPlaylistPins(id);
        if (!cancelled) setPins(ps);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Could not load playlist pins.');
      }
    })();
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        setStartPoint({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch {
        // Best-effort; we'll fall back to starting from the first pin.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Compute the route whenever pins or startPoint changes.
  const route = useMemo(() => {
    if (!pins || pins.length === 0) return null;
    const start =
      startPoint ?? {
        latitude: pins[0].latitude,
        longitude: pins[0].longitude,
      };
    return computeRoute(start, pins);
  }, [pins, startPoint]);

  if (!pins) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.text} />
      </View>
    );
  }
  if (pins.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={[styles.empty, { color: c.textMuted }]}>
          Empty playlist—add pins first.
        </Text>
      </View>
    );
  }

  const orderedPins: PlaylistPin[] = route
    ? route.order.map((i) => pins[i])
    : pins;
  const totalMeters = route?.distance ?? 0;
  const estMinutes = Math.max(
    1,
    Math.round(totalMeters / WALKING_METERS_PER_MINUTE),
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Suggested route</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          {pins.length} pin{pins.length === 1 ? '' : 's'} ·{' '}
          {formatDistance(totalMeters)} · ~{estMinutes} min walking
        </Text>
        {!startPoint && (
          <Text style={[styles.hint, { color: c.textSubtle }]}>
            Starting from the first pin (grant location access for a route
            from where you are).
          </Text>
        )}
      </View>

      <View style={[styles.mapWrap, { backgroundColor: c.card }]}>
        <PlaylistRouteMap
          start={startPoint}
          orderedPins={orderedPins}
          primaryColor={c.primary}
        />
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
          Stops in order
        </Text>
        {orderedPins.map((p, idx) => (
          <RNView
            key={p.id}
            style={[styles.row, { backgroundColor: c.card }]}
          >
            <RNView style={[styles.number, { backgroundColor: c.primary }]}>
              <Text style={[styles.numberText, { color: c.primaryText }]}>
                {idx + 1}
              </Text>
            </RNView>
            {p.image_url || p.album_image_url ? (
              <Image
                source={{ uri: p.image_url ?? p.album_image_url! }}
                style={styles.thumb}
              />
            ) : (
              <RNView
                style={[styles.thumb, { backgroundColor: c.secondaryButton }]}
              >
                <Text style={[styles.thumbLetter, { color: c.textMuted }]}>
                  {p.track_name.charAt(0).toUpperCase()}
                </Text>
              </RNView>
            )}
            <RNView style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {p.track_name}
              </Text>
              <Text
                style={[styles.rowSub, { color: c.textMuted }]}
                numberOfLines={1}
              >
                {p.artist_name}
                {p.place_name ? ` · ${p.place_name}` : ''}
              </Text>
            </RNView>
          </RNView>
        ))}
      </ScrollView>

      {error && (
        <Text style={[styles.error, { color: c.danger }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 14 },

  header: { marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 4 },
  hint: { fontSize: 11, marginTop: 6 },

  mapWrap: {
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },

  list: { flex: 1 },
  listContent: { paddingBottom: 16, gap: 6 },
  sectionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 8,
  },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { fontWeight: '800', fontSize: 14 },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbLetter: { fontWeight: '700', fontSize: 16 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12 },

  error: { textAlign: 'center', fontSize: 12, marginTop: 8 },
});
