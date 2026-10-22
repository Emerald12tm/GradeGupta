import Constants from 'expo-constants';
import { Linking, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Banner, Card, Screen, SectionHeader, Segmented } from '@/components/ui';
import { CONTACT_URL, DISCLAIMER, LEGAL_VERSION, PRIVACY_POLICY, TERMS_OF_USE, type LegalSection } from '@/config/legal';
import { Spacing } from '@/constants/theme';
import { useLocalSearchParams, router } from 'expo-router';

/**
 * About & legal: disclaimer, privacy policy and terms of use. Reachable while signed out
 * (linked from the sign-in agreement) and from the More tab.
 */
export default function LegalScreen() {
  const { tab } = useLocalSearchParams<{ tab?: 'privacy' | 'terms' }>();
  const current = tab ?? 'privacy';

  return (
    <Screen>
      <Banner text={DISCLAIMER} />
      <Segmented
        options={[
          { value: 'privacy', label: 'Privacy policy' },
          { value: 'terms', label: 'Terms of use' },
        ]}
        value={current}
        onChange={(t) => router.setParams({ tab: t })}
      />
      <Sections sections={current === 'privacy' ? PRIVACY_POLICY : TERMS_OF_USE} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
        Version {Constants.expoConfig?.version ?? '1.0.0'} · Policies updated {LEGAL_VERSION}
        {'\n'}
        <ThemedText type="small" themeColor="tint" onPress={() => Linking.openURL(CONTACT_URL)} accessibilityRole="link">
          Contact / report a problem
        </ThemedText>
      </ThemedText>
    </Screen>
  );
}

function Sections({ sections }: { sections: LegalSection[] }) {
  return (
    <>
      {sections.map((s) => (
        <View key={s.title} style={styles.section}>
          <SectionHeader title={s.title} />
          <Card>
            {s.paragraphs.map((p, i) => (
              <ThemedText key={i} type="small">
                {p}
              </ThemedText>
            ))}
          </Card>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  footer: { textAlign: 'center' },
});
