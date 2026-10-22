import { router } from 'expo-router';

import { SignInForm } from '@/components/sign-in-form';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui';

/** Adds another HAC account (a sibling, or another district) and switches to it. */
export default function AddAccountScreen() {
  return (
    <Screen>
      <ThemedText themeColor="textSecondary">
        Each account keeps its own grades, history and planner. Switch between them from the More tab.
      </ThemedText>
      <SignInForm submitTitle="Add account" onDone={() => router.back()} />
    </Screen>
  );
}
