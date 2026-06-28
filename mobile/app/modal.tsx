// "How it works" modal — opened by the (i) button on the Map tab.
// Quick orientation for first-time users.

import { StatusBar } from 'expo-status-bar';
import { Platform, ScrollView, StyleSheet } from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';

type Step = { n: string; title: string; body: string };

const STEPS: Step[] = [
  {
    n: '1',
    title: 'Pin a song to a place',
    body: 'Search tab → tap a track → set the location, clip start, and how long the clip should play.',
  },
  {
    n: '2',
    title: 'Group them into playlists',
    body: 'Open a pin → Add to playlist. Playlists are ordered and can be public for friends to follow.',
  },
  {
    n: '3',
    title: 'Walk through them',
    body: 'Map tab → Start walking. Once you\'re within ~50m of a pin, the clip plays. Stop walking turns it off.',
  },
  {
    n: '4',
    title: 'Or walk just one playlist',
    body: 'Open the playlist → Walk this playlist. Same idea but limited to that playlist\'s pins.',
  },
];

export default function HowItWorksScreen() {
  const c = useThemeColors();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>KazeTune</Text>
      <Text style={[styles.tagline, { color: c.textMuted }]}>
        Songs tied to places.
      </Text>

      {STEPS.map((s) => (
        <View key={s.n} style={styles.step}>
          <View style={[styles.stepNumber, { backgroundColor: c.primary }]}>
            <Text style={[styles.stepNumberText, { color: c.primaryText }]}>
              {s.n}
            </Text>
          </View>
          <View style={styles.stepText}>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text style={[styles.stepBody, { color: c.textMuted }]}>
              {s.body}
            </Text>
          </View>
        </View>
      ))}

      <View style={[styles.note, { backgroundColor: c.card }]}>
        <Text style={styles.noteTitle}>🎧 Playback needs Spotify Premium</Text>
        <Text style={[styles.noteBody, { color: c.textMuted }]}>
          KazeTune plays the real, full song at the exact moment you pinned
          it—which only Spotify Premium allows. That's why Premium is
          required to use the app.
        </Text>
      </View>

      <View style={[styles.note, { backgroundColor: c.card }]}>
        <Text style={styles.noteTitle}>📲 Keep Spotify open to hear clips</Text>
        <Text style={[styles.noteBody, { color: c.textMuted }]}>
          KazeTune plays through your Spotify app. Open Spotify and play (then
          pause) anything once so it becomes the active device—then clips
          will play here and on your walks. If nothing plays, that's almost
          always the fix.
        </Text>
      </View>

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48, gap: 8 },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 4 },
  tagline: { fontSize: 16, opacity: 0.6, marginBottom: 16 },

  step: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1DB954',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: 'white', fontWeight: '800' },
  stepText: { flex: 1 },
  stepTitle: { fontSize: 16, fontWeight: '700' },
  stepBody: { fontSize: 14, opacity: 0.7, marginTop: 4, lineHeight: 20 },

  note: {
    marginTop: 32,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
  },
  noteTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  noteBody: { fontSize: 13, opacity: 0.7, lineHeight: 19 },
});
