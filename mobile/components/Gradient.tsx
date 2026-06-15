// SunsetGradient — a peach → pink → lavender gradient fill for hero
// surfaces (login, headers, banners). Built on react-native-svg so it
// needs no native module / rebuild. Fills its parent; put content in
// `children` to layer on top.

import { useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useThemeColors } from './Themed';

type Props = {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Override the three stops; defaults to the theme's sunset stops. */
  colors?: [string, string, string];
  /** Diagonal (top-left → bottom-right) vs. straight vertical. */
  diagonal?: boolean;
};

export function SunsetGradient({ style, children, colors, diagonal = true }: Props) {
  const c = useThemeColors();
  const [start, mid, end] = colors ?? [c.gradientStart, c.gradientMid, c.gradientEnd];
  // Unique gradient id per instance (svg ids must not collide).
  const gid = `sunset-${useId().replace(/:/g, '')}`;

  return (
    <View style={style}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2={diagonal ? '1' : '0'} y2="1">
            <Stop offset="0" stopColor={start} />
            <Stop offset="0.5" stopColor={mid} />
            <Stop offset="1" stopColor={end} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gid})`} />
      </Svg>
      {children}
    </View>
  );
}
