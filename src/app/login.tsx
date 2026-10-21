import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Card, Screen, TextField } from '@/components/ui';
import { useSession } from '@/data/session';
import { requestNotificationPermission } from '@/sync/notifications';

/**
 * Sign in with a district HAC address + HAC username/password.
 * We log in to HAC right away to check the credentials before saving them.
 */
export default function LoginScreen() {
  const signIn = useSession((s) => s.signIn);
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn({ baseUrl, username: username.trim(), password });
      void requestNotificationPermission();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen title="GradeGupta">
        <ThemedText themeColor="textSecondary">
          Sign in with your Home Access Center account. Your password stays on this phone. It’s only sent to your
          district’s HAC site.
        </ThemedText>

        <Card>
          <TextField
            label="District HAC address"
            placeholder="hac.yourdistrict.org"
            hint="The site you open in a browser to check HAC."
            value={baseUrl}
            onChangeText={setBaseUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
          />
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

        <Button title="Sign in" onPress={submit} loading={busy} disabled={!baseUrl || !username || !password} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
