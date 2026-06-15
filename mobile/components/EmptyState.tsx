// Cute empty state — a soft icon bubble + a friendly title/subtitle.
// Used wherever a list or screen has nothing to show yet.

import { SymbolView } from 'expo-symbols';
import { type ComponentProps } from 'react';
import { StyleSheet, View as RNView } from 'react-native';

import { Text, useThemeColors } from './Themed';

type Props = {
  icon: ComponentProps<typeof SymbolView>['name'];
  title: string;
  subtitle?: string;
};

export function EmptyState({ icon, title, subtitle }: Props) {
  const c = useThemeColors();
  return (
    <RNView style={styles.wrap}>
      <RNView style={[styles.iconCircle, { backgroundColor: c.cardHighlight }]}>
        <SymbolView name={icon} tintColor={c.primary} size={38} />
      </RNView>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.body, { color: c.textMuted }]}>{subtitle}</Text>
      ) : null}
    </RNView>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
});
