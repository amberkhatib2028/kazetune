// Settings modal — opened from the Profile tab.
//
// Three sections: Appearance, Walking, Help.
//
// Why inner containers use raw RN View instead of Themed View:
// the Themed <View> auto-paints `c.background` which is pure black in
// dark mode. Inside a row sitting on the slightly-lighter `c.card`
// background, that produces visible dark rectangles around the text.
// Themed View is only used for full-bleed surfaces (the group cards).

import { router } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  View as RNView,
} from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';
import { resetOnboarding } from '@/lib/onboarding';
import {
  useThemePreference,
  type ThemePref,
} from '@/lib/themePreference';
import { useWalkingPreference } from '@/lib/walkingPreference';

const THEME_OPTIONS: { value: ThemePref; label: string; hint: string }[] = [
  { value: 'system', label: 'System', hint: 'Match my device setting' },
  { value: 'light', label: 'Light', hint: 'Always light mode' },
  { value: 'dark', label: 'Dark', hint: 'Always dark mode' },
];

export default function SettingsScreen() {
  const c = useThemeColors();
  const { pref, setPref } = useThemePreference();
  const { policy, setPolicy } = useWalkingPreference();
  const pickUpPublic = policy !== 'never';

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.container}
    >
      {/* ---- Appearance --------------------------------------------- */}
      <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
        Appearance
      </Text>
      <View style={[styles.group, { backgroundColor: c.card }]}>
        {THEME_OPTIONS.map((opt, i) => {
          const selected = pref === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setPref(opt.value)}
              style={[
                styles.row,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: c.separator,
                },
              ]}
            >
              <RNView style={styles.rowText}>
                <Text style={styles.rowTitle}>{opt.label}</Text>
                <Text style={[styles.rowHint, { color: c.textMuted }]}>
                  {opt.hint}
                </Text>
              </RNView>
              <RNView
                style={[
                  styles.radioOuter,
                  { borderColor: selected ? c.primary : c.border },
                ]}
              >
                {selected && (
                  <RNView
                    style={[styles.radioInner, { backgroundColor: c.primary }]}
                  />
                )}
              </RNView>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.footer, { color: c.textSubtle }]}>
        Theme changes apply instantly.
      </Text>

      {/* ---- Walking ------------------------------------------------ */}
      <Text style={[styles.sectionLabel, { color: c.textMuted, marginTop: 32 }]}>
        Walking
      </Text>
      <View style={[styles.group, { backgroundColor: c.card }]}>
        <RNView style={styles.row}>
          <RNView style={styles.rowText}>
            <Text style={styles.rowTitle}>Pick up public pins from others</Text>
            <Text style={[styles.rowHint, { color: c.textMuted }]}>
              When walking, play clips from public pins other users dropped.
            </Text>
          </RNView>
          <Switch
            value={pickUpPublic}
            onValueChange={(v) => setPolicy(v ? 'always' : 'never')}
          />
        </RNView>

        {pickUpPublic && (
          <>
            <Pressable
              style={[
                styles.row,
                {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: c.separator,
                },
              ]}
              onPress={() => setPolicy('always')}
            >
              <RNView style={styles.rowText}>
                <Text style={styles.rowTitle}>
                  Include public during playlist walks
                </Text>
                <Text style={[styles.rowHint, { color: c.textMuted }]}>
                  Pick up nearby public pins while walking a playlist too.
                </Text>
              </RNView>
              <RNView
                style={[
                  styles.radioOuter,
                  { borderColor: policy === 'always' ? c.primary : c.border },
                ]}
              >
                {policy === 'always' && (
                  <RNView
                    style={[styles.radioInner, { backgroundColor: c.primary }]}
                  />
                )}
              </RNView>
            </Pressable>

            <Pressable
              style={[
                styles.row,
                {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: c.separator,
                },
              ]}
              onPress={() => setPolicy('global-only')}
            >
              <RNView style={styles.rowText}>
                <Text style={styles.rowTitle}>
                  Only when not walking a playlist
                </Text>
                <Text style={[styles.rowHint, { color: c.textMuted }]}>
                  Playlist walks stay focused on the playlist's own pins.
                </Text>
              </RNView>
              <RNView
                style={[
                  styles.radioOuter,
                  {
                    borderColor:
                      policy === 'global-only' ? c.primary : c.border,
                  },
                ]}
              >
                {policy === 'global-only' && (
                  <RNView
                    style={[styles.radioInner, { backgroundColor: c.primary }]}
                  />
                )}
              </RNView>
            </Pressable>
          </>
        )}
      </View>
      <Text style={[styles.footer, { color: c.textSubtle }]}>
        Changes take effect the next time you tap Start walking.
      </Text>

      {/* ---- Help --------------------------------------------------- */}
      <Text style={[styles.sectionLabel, { color: c.textMuted, marginTop: 32 }]}>
        Help
      </Text>
      <View style={[styles.group, { backgroundColor: c.card }]}>
        <Pressable
          style={styles.row}
          onPress={() => {
            router.push('/modal');
          }}
        >
          <RNView style={styles.rowText}>
            <Text style={styles.rowTitle}>Show "How it works" again</Text>
            <Text style={[styles.rowHint, { color: c.textMuted }]}>
              Re-open the first-launch walkthrough.
            </Text>
          </RNView>
        </Pressable>
        <Pressable
          style={[
            styles.row,
            {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: c.separator,
            },
          ]}
          onPress={async () => {
            await resetOnboarding();
          }}
        >
          <RNView style={styles.rowText}>
            <Text style={styles.rowTitle}>Reset onboarding flag</Text>
            <Text style={[styles.rowHint, { color: c.textMuted }]}>
              Next launch will auto-pop "How it works" again.
            </Text>
          </RNView>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  group: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowHint: { fontSize: 12 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 24 },
});
