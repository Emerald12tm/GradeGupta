import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { TEXT_SCALE_FACTOR, useSettingsStore } from '@/settings/settings';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'largeTitle'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'caption'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  // Settings → Text size scales every style on top of the phone's own font size setting.
  const factor = TEXT_SCALE_FACTOR[useSettingsStore((s) => s.settings.textScale) ?? 'default'] ?? 1;
  const base = styles[type];
  const scaled =
    factor === 1 || !('fontSize' in base)
      ? base
      : { ...base, fontSize: (base.fontSize as number) * factor, lineHeight: 'lineHeight' in base ? (base.lineHeight as number) * factor : undefined };

  return <Text style={[{ color: theme[themeColor ?? 'text'] }, scaled, style]} {...rest} />;
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  /** Screen titles on tab screens. */
  largeTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: 800,
    letterSpacing: -0.6,
  },
  /** Big numbers (averages, GPA). Tabular digits so values don't jump as they change. */
  title: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: 700,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  subtitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  /** Section labels and small headings. */
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
