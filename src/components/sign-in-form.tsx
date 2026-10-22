import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { DistrictPicker, type DistrictChoice } from '@/components/district-picker';
import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Card, TextField } from '@/components/ui';
import { DISCLAIMER } from '@/config/legal';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/data/session';
import { normalizeBaseUrl } from '@/hac/endpoints';
import { useTheme } from '@/hooks/use-theme';
import { requestNotificationPermission } from '@/sync/notifications';

/**
 * HAC sign-in: pick a district (or type an address), then username and password.
 * Used for the first sign-in and for adding more accounts. Signs in to HAC right away so
 * wrong credentials are caught before anything is saved.
 */
export function SignInForm({ submitTitle = 'Sign in', onDone }: { submitTitle?: string; onDone?: () => void }) {
  const addAccount = useSession((s) => s.addAccount);
  const [district, setDistrict] = useState<DistrictChoice>(null);
  const [customUrl, setCustomUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [agreed, setAgreed] = useState(false);
  const theme = useTheme();

  const baseUrl = district?.kind === 'district' ? district.district.url : district?.kind === 'custom' ? customUrl : '';
  const customHost = (() => {
    if (district?.kind !== 'custom' || !customUrl.trim()) return null;
    try {
      return new URL(normalizeBaseUrl(customUrl)).host;
    } catch {
      return null;
    }
  })();

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await addAccount({
        baseUrl,
        username: username.trim(),
        password,
        districtName: district?.kind === 'district' ? district.district.name : undefined,
      });
      void requestNotificationPermission();
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {Platform.OS === 'web' ? (
        <Banner
          tone="warning"
          text="Signing in doesn’t work in a web browser: browsers block websites from talking to your district’s HAC. Use the app on your phone (Expo Go or a build). The web version is only a preview."
        />
      ) : null}
      <Card>
        <DistrictPicker value={district} onChange={setDistrict} />
        {district?.kind === 'custom' ? (
          <>
            <TextField
              label="District HAC address"
              placeholder="hac.yourdistrict.org"
              hint="The site you open in a browser to check HAC."
              value={customUrl}
              onChangeText={setCustomUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              textContentType="URL"
            />
            {customHost ? (
              <Banner
                tone="warning"
                text={`Your password will be sent to ${customHost}. This address isn’t on GradeGupta’s verified list, so only continue if it’s your district’s official Home Access Center site.`}
              />
            ) : null}
          </>
        ) : null}
        <TextField
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          autoComplete="username"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
          onSubmitEditing={submit}
        />
      </Card>

      {error ? <Banner tone="warning" text={error} /> : null}

      <Pressable
        onPress={() => setAgreed((a) => !a)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        style={styles.agreeRow}>
        <Ionicons name={agreed ? 'checkbox' : 'square-outline'} size={24} color={agreed ? theme.tint : theme.textSecondary} />
        <ThemedText type="small" style={styles.flex}>
          I’m allowed to use this HAC account, and I agree to the{' '}
          <ThemedText type="small" themeColor="tint" onPress={() => router.push({ pathname: '/legal', params: { tab: 'terms' } })}>
            Terms of Use
          </ThemedText>{' '}
          and{' '}
          <ThemedText type="small" themeColor="tint" onPress={() => router.push({ pathname: '/legal', params: { tab: 'privacy' } })}>
            Privacy Policy
          </ThemedText>
          .
        </ThemedText>
      </Pressable>

      <Button title={submitTitle} onPress={submit} loading={busy} disabled={!baseUrl || !username || !password || !agreed} />

      <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
        {DISCLAIMER}
      </ThemedText>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, paddingHorizontal: Spacing.one },
  disclaimer: { textAlign: 'center', paddingHorizontal: Spacing.two },
});
