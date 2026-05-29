/**
 * Theme-aware wrappers for Text/View, plus a useThemeColors() hook for
 * everything else that needs colors (buttons, inputs, badges, etc.).
 *
 * Usage:
 *   const c = useThemeColors();
 *   <TextInput style={{ backgroundColor: c.inputBackground, color: c.inputText }} />
 */
import { Text as DefaultText, View as DefaultView } from 'react-native';

import Colors, { type ThemeColors } from '@/constants/Colors';
import { useResolvedScheme } from '@/lib/themePreference';

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText['props'];
export type ViewProps = ThemeProps & DefaultView['props'];

export function useThemeColors(): ThemeColors {
  const theme = useResolvedScheme();
  return Colors[theme];
}

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof ThemeColors,
) {
  const theme = useResolvedScheme();
  const colorFromProps = props[theme];
  return colorFromProps ?? Colors[theme][colorName];
}

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  return <DefaultText style={[{ color }, style]} {...otherProps} />;
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    'background',
  );
  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
