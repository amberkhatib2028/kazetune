// Round profile picture with letter-fallback. Used by friends rows,
// playlist "by X" labels, and the profile screen.

import { Image, StyleSheet, View } from 'react-native';

import { Text, useThemeColors } from '@/components/Themed';

type Props = {
  uri?: string | null;
  name?: string | null;
  size?: number;
};

export function Avatar({ uri, name, size = 40 }: Props) {
  const c = useThemeColors();
  const radius = size / 2;
  const letter = (name ?? '?').trim().charAt(0).toUpperCase() || '?';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius: radius }]}
      />
    );
  }
  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: c.primary,
        },
      ]}
    >
      <Text
        style={[
          styles.letter,
          { color: c.primaryText, fontSize: size * 0.45 },
        ]}
      >
        {letter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontWeight: '800' },
});
