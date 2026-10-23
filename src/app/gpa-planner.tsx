import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Divider, ErrorState, LoadingState, Pill, Screen, SectionHeader, toNumber } from '@/components/ui';
import { gradeColor, Spacing } from '@/constants/theme';
import { useGrades } from '@/data/queries';
import { formatAverage } from '@/grades/average';
import { projectGpa } from '@/grades/planning';
import { useTheme } from '@/hooks/use-theme';
import { applyCourseOverrides, gpaScaleFor, useSettings } from '@/settings/settings';

/**
 * GPA planner: type the grade you expect to finish each class with and see what your GPA
 * would be. Blank boxes keep the current average. Nothing is saved or sent anywhere.
 */
export default function GpaPlannerScreen() {
  const theme = useTheme();
  const settings = useSettings();
  const { data, isLoading, error, refetch } = useGrades();
  const [plan, setPlan] = useState<Record<string, string>>({});

  if (isLoading) return <LoadingState />;
  if (!data) return <ErrorState error={error} onRetry={refetch} />;

  const courses = applyCourseOverrides(data.page.courses, settings.courseOverrides);
  const projected = Object.fromEntries(Object.entries(plan).map(([id, text]) => [id, toNumber(text) ?? undefined]));
  const r = projectGpa(courses, projected, gpaScaleFor(settings), (c) => !!settings.courseOverrides[c.name]?.excludeFromGpa);
  const delta = r.projected.weighted !== null && r.current.weighted !== null ? r.projected.weighted - r.current.weighted : 0;

  return (
    <Screen>
      <Card>
        <View style={styles.compare}>
          <View style={styles.flex}>
            <ThemedText type="caption" themeColor="textSecondary">
              Now
            </ThemedText>
            <ThemedText type="subtitle">{r.current.weighted?.toFixed(3) ?? '—'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Unweighted {r.current.unweighted?.toFixed(2) ?? '—'}
            </ThemedText>
          </View>
          <View style={[styles.flex, styles.right]}>
            <ThemedText type="caption" themeColor="textSecondary">
              Planned
            </ThemedText>
            <ThemedText type="subtitle" style={{ color: theme.tint }}>
              {r.projected.weighted?.toFixed(3) ?? '—'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Unweighted {r.projected.unweighted?.toFixed(2) ?? '—'}
            </ThemedText>
          </View>
        </View>
        {Math.abs(delta) >= 0.0005 ? (
          <Pill
            icon={delta > 0 ? 'trending-up' : 'trending-down'}
            label={`${delta > 0 ? '+' : ''}${delta.toFixed(3)} weighted GPA`}
            color={delta > 0 ? theme.success : theme.danger}
          />
        ) : null}
      </Card>

      <SectionHeader title="Planned final grade per class" />
      <Card>
        {courses.map((c, i) => (
          <View key={c.id}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.row}>
              <View style={styles.flex}>
                <ThemedText numberOfLines={1}>{c.name}</ThemedText>
                <ThemedText type="small" style={{ color: gradeColor(c.reportedAverage, theme) }}>
                  Now {formatAverage(c.reportedAverage)}
                </ThemedText>
              </View>
              <TextInput
                value={plan[c.id] ?? ''}
                onChangeText={(t) => setPlan((p) => ({ ...p, [c.id]: t.replace(/[^0-9.]/g, '') }))}
                placeholder={c.reportedAverage === null ? '—' : String(Math.round(c.reportedAverage))}
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                accessibilityLabel={`Planned final grade for ${c.name}`}
                style={[styles.input, { color: theme.text, borderColor: plan[c.id] ? theme.tint : theme.track, backgroundColor: theme.background }]}
              />
            </View>
          </View>
        ))}
      </Card>
      <Button title="Reset plan" variant="secondary" icon="refresh" onPress={() => setPlan({})} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        Uses your GPA scale and class levels from Settings. Planned grades aren’t saved.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  right: { alignItems: 'flex-end' },
  compare: { flexDirection: 'row', gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  input: { width: 84, minHeight: 44, borderWidth: 1.5, borderRadius: 10, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  note: { textAlign: 'center' },
});
