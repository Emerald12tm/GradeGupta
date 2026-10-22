import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { SignInForm } from '@/components/sign-in-form';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui';

/** First sign-in. More accounts can be added later from the More tab. */
export default function LoginScreen() {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen title="GradeGupta">
        <ThemedText themeColor="textSecondary">
          Sign in with your Home Access Center account. Your password stays on this phone. It’s only sent to your
          district’s HAC site.
        </ThemedText>
        <SignInForm />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
