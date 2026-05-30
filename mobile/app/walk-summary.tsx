// Walk summary modal — pops up after the user taps "Stop walking".
// Reads the most-recent walk from lib/walkRecorder (a process-local
// singleton — no Supabase round-trip), draws the path on a MapView,
// and lists the pins the user collected along the way.

import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View as RNView,
} from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';
import WalkSummaryMap from '@/components/WalkSummaryMap';
import {
  formatDistance,
  formatDuration,
  getLastWalk,
  pathLengthMeters,
} from '@/lib/walkRecorder';

export default function WalkSummaryScreen() {
  const c = useThemeColors();
  const walk = useMemo(() => getLastWalk(), []);

  // If somebody opened this URL directly with no walk staged, just
  // bounce back. (Shouldn't happen in normal use.)
  useEffect(() => {
    if (!walk) {
      router.back();
    }
  }, [walk]);

  if (!walk) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: c.textMuted }}>No walk to summarize.</Text>
      </View>
    );
  }

  const distance = pathLengthMeters(walk.path);
  const duration = walk.endedAt - walk.startedAt;
  const polylineCoords = walk.path.map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
  }));

  // Center the map around the bounding box of path + pins. If we have
  // no path points (background-only walk), fall back to a region that
  // covers just the collected pins.
  const allLats = [
    ...polylineCoords.map((p) => p.latitude),
    ...walk.collectedPins.map((p) => p.latitude),
  ];
  const allLngs = [
    ...polylineCoords.map((p) => p.longitude),
    ...walk.collectedPins.map((p) => p.longitude),
  ];
  const initialRegion = (() => {
    if (allLats.length === 0) {
      return {
        latitude: 40.34942,
        longitude: -74.65691,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);
    const minLng = Math.min(...allLngs);
    const maxLng = Math.max(...allLngs);
    const latDelta = Math.max(0.005, (maxLat - minLat) * 1.6);
    const lngDelta = Math.max(0.005, (maxLng - minLng) * 1.6);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  })();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Walk complete</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          {new Date(walk.startedAt).toLocaleString()}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Pins collected" value={`${walk.collectedPins.length}`} c={c} />
        <Stat label="Distance" value={formatDistance(distance)} c={c} />
        <Stat label="Duration" value={formatDuration(duration)} c={c} />
      </View>

      <View style={[styles.mapWrap, { backgroundColor: c.card }]}>
        <WalkSummaryMap
          path={polylineCoords}
          pins={walk.collectedPins}
          primaryColor={c.primary}
          initialRegion={initialRegion}
        />
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
          Tracks collected
        </Text>
        {walk.collectedPins.length === 0 ? (
          <Text style={[styles.emptyText, { color: c.textMuted }]}>
            None this walk — get a little closer next time.
          </Text>
        ) : (
          walk.collectedPins.map((p) => (
            <RNView
              key={p.id}
              style={[styles.row, { backgroundColor: c.card }]}
            >
              {p.image_url || p.album_image_url ? (
                <Image
                  source={{ uri: p.image_url ?? p.album_image_url! }}
                  style={styles.thumb}
                />
              ) : (
                <RNView style={[styles.thumb, { backgroundColor: c.primary }]}>
                  <Text style={[styles.thumbLetter, { color: c.primaryText }]}>
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
          ))
        )}
      </ScrollView>

      <Pressable
        style={[styles.doneBtn, { backgroundColor: c.primary }]}
        onPress={() => router.back()}
      >
        <Text style={[styles.doneBtnText, { color: c.primaryText }]}>Done</Text>
      </Pressable>
    </View>
  );
}

function Stat({
  label,
  value,
  c,
}: {
  label: string;
  value: string;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <RNView style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.textMuted }]}>{label}</Text>
    </RNView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
    gap: 8,
  },
  stat: { flex: 1 },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2, textTransform: 'uppercase' },

  mapWrap: {
    height: 220,
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
  emptyText: { fontSize: 13, marginTop: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 8,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbLetter: { fontWeight: '800', fontSize: 18 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12 },

  doneBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  doneBtnText: { fontWeight: '700', fontSize: 16 },
});
