import { useColorScheme as useSystemColorScheme } from 'react-native';

import { themeById } from '@/constants/theme';
import { useSettingsStore } from '@/settings/settings';

/**
 * The color scheme the app should render in: the theme's forced scheme if it has one
 * (Midnight is always dark), otherwise the user's Appearance setting, otherwise the phone's.
 */
export function useColorScheme(): 'light' | 'dark' {
  const system = useSystemColorScheme();
  const themeId = useSettingsStore((s) => s.settings.themeId);
  const appearance = useSettingsStore((s) => s.settings.appearance);
  const forced = themeById(themeId).forceScheme;
  if (forced) return forced;
  if (appearance !== 'system') return appearance;
  return system === 'dark' ? 'dark' : 'light';
}
