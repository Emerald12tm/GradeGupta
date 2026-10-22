import { themeById, type Palette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettingsStore } from '@/settings/settings';

/** Current palette: the user's theme in the resolved light/dark scheme. */
export function useTheme(): Palette {
  const scheme = useColorScheme();
  const themeId = useSettingsStore((s) => s.settings.themeId);
  return themeById(themeId)[scheme];
}
