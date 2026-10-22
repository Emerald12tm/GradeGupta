import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';

// Importing this module also registers the background sync task, which must happen at startup.
import { disableBackgroundSync, enableBackgroundSync } from '@/background/task';
import { LockGate } from '@/components/lock-gate';
import { queryClient } from '@/data/queries';
import { useSession } from '@/data/session';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useSettingsStore } from '@/settings/settings';
import { configureNotifications } from '@/sync/notifications';

/**
 * Root layout: providers, the sign-in guard and the screen list.
 *
 * Signed-out users can only reach `/login`; signed-in users can reach everything else.
 * `Stack.Protected` swaps the available routes when the session status changes, so signing
 * in or out navigates automatically.
 */

void SplashScreen.preventAutoHideAsync();
configureNotifications();

export default function RootLayout() {
  const scheme = useColorScheme();
  const palette = useTheme();
  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: palette.tint,
        background: palette.background,
        card: palette.backgroundElement,
        text: palette.text,
        border: palette.border,
      },
    };
  }, [scheme, palette]);
  const status = useSession((s) => s.status);
  const restore = useSession((s) => s.restore);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const backgroundSync = useSettingsStore((s) => s.settings.backgroundSync);

  useEffect(() => {
    restore().catch(() => useSession.setState({ status: 'signedOut' }));
    hydrate().catch(() => useSettingsStore.setState({ hydrated: true }));
  }, [restore, hydrate]);

  const ready = status !== 'loading' && hydrated;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    if (status !== 'signedIn') return;
    (backgroundSync ? enableBackgroundSync() : disableBackgroundSync()).catch(() => {});
  }, [status, backgroundSync]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <LockGate>
          <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
            <Stack.Protected guard={status === 'signedIn'}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="class/[id]" options={{ title: '' }} />
              <Stack.Screen name="calculator" options={{ title: 'Final Exam Calculator' }} />
              <Stack.Screen name="schedule" options={{ title: 'Schedule' }} />
              <Stack.Screen name="report-card" options={{ title: 'Report Card' }} />
              <Stack.Screen name="transcript" options={{ title: 'Transcript & GPA' }} />
              <Stack.Screen name="attendance" options={{ title: 'Attendance' }} />
              <Stack.Screen name="progress" options={{ title: 'Progress Report' }} />
              <Stack.Screen name="settings" options={{ title: 'Settings' }} />
              <Stack.Screen name="add-account" options={{ title: 'Add Account', presentation: 'modal' }} />
            </Stack.Protected>
            <Stack.Protected guard={status === 'signedOut'}>
              <Stack.Screen name="login" options={{ headerShown: false }} />
            </Stack.Protected>
            {/* Always reachable: the sign-in agreement links here before an account exists. */}
            <Stack.Screen name="legal" options={{ title: 'About & Legal' }} />
          </Stack>
        </LockGate>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
