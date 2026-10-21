/**
 * Design tokens: colors for light and dark mode, fonts and spacing.
 * Read colors through `useTheme()` so screens follow the system appearance.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#F7F7F9',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E6E8EE',
    textSecondary: '#60646C',
    border: '#E2E4EA',
    tint: '#3D5AFE',
    onTint: '#FFFFFF',
    success: '#1F9D55',
    warning: '#C27803',
    danger: '#D93025',
  },
  dark: {
    text: '#ECEDEE',
    background: '#0B0C0E',
    backgroundElement: '#17181B',
    backgroundSelected: '#26282D',
    textSecondary: '#A0A4AB',
    border: '#2A2C31',
    tint: '#8C9EFF',
    onTint: '#0B0C0E',
    success: '#4CC38A',
    warning: '#F0B429',
    danger: '#FF6B5E',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Color for a percent grade: green A, neutral B, amber C, red failing. */
export function gradeColor(average: number | null, theme: (typeof Colors)['light' | 'dark']): string {
  if (average === null) return theme.textSecondary;
  if (average >= 90) return theme.success;
  if (average >= 80) return theme.text;
  if (average >= 70) return theme.warning;
  return theme.danger;
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
