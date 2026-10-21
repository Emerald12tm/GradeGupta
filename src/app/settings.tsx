import * as LocalAuthentication from 'expo-local-authentication';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { runBackgroundSyncForTesting } from '@/background/task';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Divider, ListRow, NumberField, Screen, SectionHeader, ToggleRow, toNumber } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/data/session';
import { GPA_PRESETS } from '@/grades/gpa';
import { SEMESTER_PRESETS } from '@/grades/semester';
import { useTheme } from '@/hooks/use-theme';
import { semesterWeightsFor, useSettings, useSettingsStore } from '@/settings/settings';
import { requestNotificationPermission } from '@/sync/notifications';

/** Settings: account, GPA scale, semester formula, notifications, background checks, Face ID. */
export default function SettingsScreen() {
  const theme = useTheme();
  const settings = useSettings();
  const update = useSettingsStore((s) => s.update);
  const { baseUrl, username, signOut } = useSession();

  const weights = semesterWeightsFor(settings);
  const [custom, setCustom] = useState({
    periods: weights.periods.map((p) => String(Math.round(p * 1000) / 10)),
    exam: String(Math.round(weights.exam * 1000) / 10),
  });

  const saveCustom = () => {
    const periods = custom.periods.map(toNumber);
    const exam = toNumber(custom.exam);
    if (periods.some((p) => p === null) || exam === null) return;
    void update({ semesterPreset: 'custom', customSemester: { periods: periods as number[], exam } });
  };

  const choose = (selected: boolean) => ({ color: selected ? theme.tint : theme.text });

  return (
    <Screen>
      <SectionHeader title="Account" />
      <Card>
        <ListRow title={username ?? ''} subtitle={baseUrl ?? ''} />
        <Button
          title="Sign out"
          variant="danger"
          onPress={() =>
            Alert.alert('Sign out?', 'This removes your HAC login and all saved grade history from this phone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ])
          }
        />
      </Card>

      <SectionHeader title="GPA scale" />
      <Card>
        {Object.entries(GPA_PRESETS).map(([key, p], i) => (
          <View key={key}>
            {i > 0 ? <Divider /> : null}
            <Pressable onPress={() => void update({ gpaPreset: key })} accessibilityRole="radio" accessibilityState={{ selected: settings.gpaPreset === key }} style={styles.option}>
              <ThemedText style={choose(settings.gpaPreset === key)}>{p.label}</ThemedText>
            </Pressable>
          </View>
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          Set each class’s level (Regular/Honors/AP) and credits from its class page.
        </ThemedText>
      </Card>

      <SectionHeader title="Semester formula" />
      <Card>
        {SEMESTER_PRESETS.map((p, i) => (
          <View key={p.id}>
            {i > 0 ? <Divider /> : null}
            <Pressable onPress={() => void update({ semesterPreset: p.id })} accessibilityRole="radio" accessibilityState={{ selected: settings.semesterPreset === p.id }} style={styles.option}>
              <ThemedText style={choose(settings.semesterPreset === p.id)}>{p.label}</ThemedText>
            </Pressable>
          </View>
        ))}
        <Divider />
        <ThemedText type="smallBold" style={choose(settings.semesterPreset === 'custom')}>
          Custom (percent)
        </ThemedText>
        <View style={styles.row}>
          {custom.periods.map((v, i) => (
            <View key={i} style={styles.flex}>
              <NumberField
                label={`Period ${i + 1}`}
                value={v}
                onChangeText={(t) => setCustom((c) => ({ ...c, periods: c.periods.map((p, j) => (j === i ? t : p)) }))}
              />
            </View>
          ))}
          <View style={styles.flex}>
            <NumberField label="Exam" value={custom.exam} onChangeText={(t) => setCustom((c) => ({ ...c, exam: t }))} />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button
              title={custom.periods.length === 3 ? 'Use 2 periods' : 'Use 3 periods'}
              variant="secondary"
              onPress={() => setCustom((c) => ({ ...c, periods: c.periods.length === 3 ? c.periods.slice(0, 2) : [...c.periods, c.periods[0] ?? '0'] }))}
            />
          </View>
          <View style={styles.flex}>
            <Button title="Save custom" onPress={saveCustom} />
          </View>
        </View>
      </Card>

      <SectionHeader title="Notifications" />
      <Card>
        <ToggleRow
          title="New and changed grades"
          value={settings.notifyGrades}
          onChange={(v) => {
            void update({ notifyGrades: v });
            if (v) void requestNotificationPermission();
          }}
        />
        <Divider />
        <ToggleRow title="Class average changes" value={settings.notifyAverages} onChange={(v) => void update({ notifyAverages: v })} />
        {settings.notifyAverages ? (
          <NumberField
            label="Only when it moves by at least"
            value={String(settings.minAverageChange)}
            onChangeText={(t) => void update({ minAverageChange: toNumber(t) ?? 0 })}
          />
        ) : null}
        <Divider />
        <ToggleRow
          title="Low grade alert"
          subtitle="Tell me when any class drops below a number"
          value={settings.lowGradeAlert !== null}
          onChange={(v) => void update({ lowGradeAlert: v ? 80 : null })}
        />
        {settings.lowGradeAlert !== null ? (
          <NumberField label="Alert below" value={String(settings.lowGradeAlert)} onChangeText={(t) => void update({ lowGradeAlert: toNumber(t) ?? 0 })} />
        ) : null}
        <Divider />
        <ToggleRow
          title="Check in the background"
          subtitle="Your phone decides how often, usually every 30 minutes to a few hours."
          value={settings.backgroundSync}
          onChange={(v) => void update({ backgroundSync: v })}
        />
        {__DEV__ ? <Button title="Run background check now (dev)" variant="secondary" onPress={() => void runBackgroundSyncForTesting()} /> : null}
      </Card>

      <SectionHeader title="Privacy" />
      <Card>
        <ToggleRow
          title="Require Face ID / fingerprint"
          value={settings.biometricLock}
          onChange={async (v) => {
            if (v && !((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()))) {
              Alert.alert('Not available', 'Set up Face ID, Touch ID or a fingerprint in your phone’s settings first.');
              return;
            }
            void update({ biometricLock: v });
          }}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Your HAC password is stored in the phone’s secure keychain. Grades are stored only on this phone. GradeGupta has no
          server and no account.
        </ThemedText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { paddingVertical: Spacing.two, minHeight: 44, justifyContent: 'center' },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
