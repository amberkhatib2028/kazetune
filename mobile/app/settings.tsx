// Settings modal — opened from the Profile tab.
// Right now: theme override (System / Light / Dark). Future settings
// (notifications, privacy defaults for new pins, etc.) drop in here as
// new sections.

import { ScrollView, StyleSheet, Pressable } from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';
import {
  useThemePreference,
  type ThemePref,
} from '@/lib/themePreference';

const THEME_OPTIONS: { value: ThemePref; label: string; hint: string }[] = [
  { value: 'system', label: 'System', hint: 'Match my device setting' },
  { value: 'light', label: 'Light', hint: 'Always light mode' },
  { value: 'dark', label: 'Dark', hint: 'Always dark mode' },
];

export default function SettingsScreen() {
  const c = useThemeColors();
  const { pref, setPref } = useThemePreference();

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.container}
    >
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
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{opt.label}</Text>
                <Text style={[styles.rowHint, { color: c.textMuted }]}>
                  {opt.hint}
                </Text>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: selected ? c.primary : c.border },
                ]}
              >
                {selected && (
                  <View
                    style={[styles.radioInner, { backgroundColor: c.primary }]}
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.footer, { color: c.textSubtle }]}>
        Theme changes apply instantly.
      </Text>
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
