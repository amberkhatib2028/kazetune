// VisibilitySelector — a 3-way "who can see this pin" control:
// Private (only you) · Friends (you + friends) · Everyone (anyone nearby).
// Used on create-pin, edit-pin, and pin-detail.

import { Pressable, StyleSheet, View as RNView } from 'react-native';

import { Text, useThemeColors } from './Themed';
import type { PinVisibility } from '@/lib/pins';

const OPTIONS: { value: PinVisibility; label: string; hint: string }[] = [
  { value: 'private', label: 'Private', hint: 'Only you can see and hear this pin.' },
  { value: 'friends', label: 'Friends', hint: 'You and your friends can pick it up.' },
  { value: 'public', label: 'Everyone', hint: 'Anyone who walks by can pick it up.' },
];

export function VisibilitySelector({
  value,
  onChange,
  disabled,
}: {
  value: PinVisibility;
  onChange: (v: PinVisibility) => void;
  disabled?: boolean;
}) {
  const c = useThemeColors();
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];

  return (
    <RNView style={styles.wrap}>
      <RNView style={[styles.segmented, { backgroundColor: c.card }]}>
        {OPTIONS.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              disabled={disabled}
              style={[styles.segment, selected && { backgroundColor: c.primary }]}
              onPress={() => onChange(o.value)}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: selected ? c.primaryText : c.text },
                ]}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </RNView>
      <Text style={[styles.hint, { color: c.textMuted }]}>{current.hint}</Text>
    </RNView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 4 },
  segmented: { flexDirection: 'row', borderRadius: 24, padding: 3, gap: 3 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 21, alignItems: 'center' },
  segmentText: { fontWeight: '600', fontSize: 14 },
  hint: { fontSize: 13, marginLeft: 4 },
});
