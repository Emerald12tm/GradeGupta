import Ionicons from '@expo/vector-icons/Ionicons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/settings/settings';

/**
 * Optional Face ID / fingerprint lock. When enabled in Settings, the app content is hidden
 * until the user authenticates, and it locks again after the app has been in the background
 * for `RELOCK_AFTER_MS`.
 */

const RELOCK_AFTER_MS = 60_000;

export function LockGate({ children }: { children: ReactNode }) {
  const { biometricLock } = useSettings();
  const theme = useTheme();
  const [unlocked, setUnlocked] = useState(false);
  // While the app isn't in the foreground, cover it so grades don't show in the app switcher.
  const [covered, setCovered] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(() => {
    void LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock GradeGupta' }).then((result) => {
      if (result.success) setUnlocked(true);
    });
  }, []);

  // Prompt automatically whenever the app becomes locked.
  useEffect(() => {
    if (!biometricLock || unlocked) return;
    void LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock GradeGupta' }).then((result) => {
      if (result.success) setUnlocked(true);
    });
  }, [biometricLock, unlocked]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setCovered(state !== 'active');
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current && Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) {
        setUnlocked(false);
      }
    });
    return () => sub.remove();
  }, []);

  if (!biometricLock) return <>{children}</>;
  if (unlocked) {
    return (
      <View style={styles.fill}>
        {children}
        {covered ? (
          <View style={[StyleSheet.absoluteFill, styles.locked, { backgroundColor: theme.background }]}>
            <Ionicons name="lock-closed" size={40} color={theme.tint} />
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <View style={[styles.locked, { backgroundColor: theme.background }]}>
      <Ionicons name="lock-closed" size={40} color={theme.tint} />
      <ThemedText type="subtitle">GradeGupta is locked</ThemedText>
      <Button title="Unlock" icon="finger-print" onPress={unlock} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four, padding: Spacing.four },
});
