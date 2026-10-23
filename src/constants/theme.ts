/**
 * Design tokens: color themes (each with a light and dark palette), fonts and spacing.
 *
 * Screens read colors through `useTheme()`, which picks the user's theme (Settings →
 * Theme) and appearance (System / Light / Dark). Every palette has the same keys, so a
 * component styled with `theme.tint` works in every theme.
 */

import { Platform } from 'react-native';

export interface Palette {
  text: string;
  textSecondary: string;
  background: string;
  /** Cards, inputs, tab bar. */
  backgroundElement: string;
  /** Pressed/selected surfaces, segmented control track. */
  backgroundSelected: string;
  border: string;
  /** Accent: buttons, links, highlights. */
  tint: string;
  /** Text/icons drawn on top of `tint`. */
  onTint: string;
  success: string;
  warning: string;
  danger: string;
  /** Off state of switches and other controls that must be visible (3:1 against cards). */
  track: string;
  /** Letter-grade colors: A green, B blue, C amber, F red. Readable as text on cards. */
  gradeA: string;
  gradeB: string;
  gradeC: string;
  gradeF: string;
}

export type ThemeColor = keyof Palette;

/** Opacity of tinted backgrounds behind colored text (pills, badges, banners, icon tiles). */
export const TINT_ALPHA = 0.1;

// Every text color here meets WCAG AA (4.5:1) on `background`, `backgroundElement` and on its
// own 14% tint; src/constants/__tests__/theme.test.ts checks all themes.
const BASE_LIGHT: Palette = {
  text: '#11181C',
  textSecondary: '#5A5F67',
  background: '#F7F7F9',
  backgroundElement: '#FFFFFF',
  backgroundSelected: '#E6E8EE',
  border: '#E2E4EA',
  tint: '#3550E8',
  onTint: '#FFFFFF',
  success: '#0F6E38',
  warning: '#8F5500',
  danger: '#C5221F',
  track: '#7A8089',
  gradeA: '#0F6E38',
  gradeB: '#1D5FD1',
  gradeC: '#8F5500',
  gradeF: '#C5221F',
};

const BASE_DARK: Palette = {
  text: '#ECEDEE',
  textSecondary: '#A6AAB1',
  background: '#0B0C0E',
  backgroundElement: '#17181B',
  backgroundSelected: '#26282D',
  border: '#2A2C31',
  tint: '#8C9EFF',
  onTint: '#0B0C0E',
  success: '#4CC38A',
  warning: '#F0B429',
  danger: '#FF6B5E',
  track: '#6E737D',
  gradeA: '#4CC38A',
  gradeB: '#6EA8FF',
  gradeC: '#F0B429',
  gradeF: '#FF6B5E',
};

export interface AppTheme {
  id: string;
  name: string;
  light: Palette;
  dark: Palette;
  /** Themes that only make sense one way (Midnight) ignore the appearance setting. */
  forceScheme?: 'light' | 'dark';
}

const theme = (id: string, name: string, light: Partial<Palette>, dark: Partial<Palette>, forceScheme?: 'dark'): AppTheme => {
  const darkPalette = { ...BASE_DARK, ...dark };
  // A dark-only theme uses its dark palette everywhere (its light colors would never be readable).
  return { id, name, light: forceScheme ? darkPalette : { ...BASE_LIGHT, ...light }, dark: darkPalette, forceScheme };
};

const midnight: Partial<Palette> = {
  background: '#0A0E1A',
  backgroundElement: '#111729',
  backgroundSelected: '#1B2340',
  border: '#222B4A',
  tint: '#7AA2F7',
  onTint: '#0A0E1A',
};

export const THEMES: AppTheme[] = [
  theme('classic', 'Classic', {}, {}),
  theme(
    'green',
    'Green',
    { tint: '#14733D', background: '#F4F8F5', backgroundSelected: '#E2EFE6', border: '#D9E6DD' },
    { tint: '#4ADE80', background: '#08100B', backgroundElement: '#111B15', backgroundSelected: '#1C2B21', border: '#22332A' },
  ),
  theme(
    'ocean',
    'Ocean',
    { tint: '#00669C', background: '#F3F8FB', backgroundSelected: '#DDEEF7', border: '#D3E4EE' },
    { tint: '#4CC9F0', background: '#06111A', backgroundElement: '#0D1C28', backgroundSelected: '#16293A', border: '#1C3245' },
  ),
  theme(
    'sunset',
    'Sunset',
    { tint: '#B8440A', background: '#FFF7F2', backgroundSelected: '#FBE6D9', border: '#F2DCCD' },
    { tint: '#FF922B', background: '#140B07', backgroundElement: '#1F130D', backgroundSelected: '#2E1D14', border: '#38241A' },
  ),
  theme(
    'amethyst',
    'Amethyst',
    { tint: '#7B3FE4', background: '#F8F5FD', backgroundSelected: '#EBE2FA', border: '#E2D8F3' },
    { tint: '#B197FC', background: '#0E0A16', backgroundElement: '#181224', backgroundSelected: '#241B36', border: '#2D2241' },
  ),
  theme(
    'ruby',
    'Ruby',
    { tint: '#C81E3A', background: '#FCF4F5', backgroundSelected: '#F6DDE1', border: '#EFD3D8' },
    { tint: '#FF6B81', background: '#140709', backgroundElement: '#1F0E12', backgroundSelected: '#2E161B', border: '#381C22' },
  ),
  theme(
    'lemon',
    'Lemon',
    { tint: '#6E5900', onTint: '#FFFFFF', background: '#FFFDF0', backgroundSelected: '#F7F0C8', border: '#EEE6BF' },
    { tint: '#FFE066', onTint: '#1A1600', background: '#12110A', backgroundElement: '#1C1A10', backgroundSelected: '#2A2717', border: '#333020' },
  ),
  theme(
    'magenta',
    'Magenta',
    { tint: '#C2188F', background: '#FDF4FB', backgroundSelected: '#F7DDF0', border: '#EFD2E7' },
    { tint: '#FF7AD9', background: '#14070F', backgroundElement: '#200E19', backgroundSelected: '#2F1626', border: '#3A1C2F' },
  ),
  theme(
    'marine',
    'Marine',
    { tint: '#0F766E', background: '#F2F8F7', backgroundSelected: '#D9EEEB', border: '#D0E4E1' },
    { tint: '#2DD4BF', background: '#061210', backgroundElement: '#0C1C19', backgroundSelected: '#142B27', border: '#1A3530' },
  ),
  theme('midnight', 'Midnight', midnight, midnight, 'dark'),
  theme(
    'terracotta',
    'Terracotta',
    { tint: '#A6492A', background: '#FBF5F2', backgroundSelected: '#F3E1D9', border: '#EAD7CE' },
    { tint: '#E9896A', background: '#130C09', backgroundElement: '#1E1410', backgroundSelected: '#2C1E17', border: '#36251D' },
  ),
];

export const DEFAULT_THEME_ID = 'classic';

export const themeById = (id: string): AppTheme => THEMES.find((t) => t.id === id) ?? THEMES[0];

/** The default theme's palettes, for code outside React that just needs neutral colors. */
export const Colors = { light: THEMES[0].light, dark: THEMES[0].dark };

/**
 * Color for a percent grade, used everywhere a grade is shown (class list, badges,
 * categories, assignments): A green, B blue, C amber, failing red, ungraded gray.
 */
export function gradeColor(average: number | null, theme: Palette): string {
  if (average === null) return theme.textSecondary;
  if (average >= 90) return theme.gradeA;
  if (average >= 80) return theme.gradeB;
  if (average >= 70) return theme.gradeC;
  return theme.gradeF;
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
