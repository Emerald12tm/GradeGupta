import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Banner, Card, EmptyState, ErrorState, LoadingState, Pill, Screen, Segmented } from '@/components/ui';
import { gradeColor, Spacing } from '@/constants/theme';
import { useGrades } from '@/data/queries';
import { formatAverage, letterGrade } from '@/grades/average';
import { averageMismatch } from '@/grades/solver';
import { useTheme } from '@/hooks/use-theme';
import { applyCourseOverrides, useSettings } from '@/settings/settings';
import { currentGpa } from '@/sync/sync';

/**
 * Grades tab: GPA at the top, then one card per class with its average.
 * Pull to refresh re-scrapes HAC (and records history). The segmented control switches
 * marking periods.
 */
export default function GradesScreen() {
  const theme = useTheme();
  const settings = useSettings();
  const [period, setPeriod] = useState<string | undefined>(undefined);
  const { data, error, isLoading, isRefetching, refetch } = useGrades(period);

  if (isLoading) return <LoadingState label="Signing in to HAC…" />;
  if (error && !data) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  const { markingPeriods } = data.page;
  const courses = applyCourseOverrides(data.page.courses, settings.courseOverrides);
  const gpa = currentGpa(courses, settings);
  const selected = period ?? markingPeriods.find((p) => p.selected)?.value;
  const newGrades = data.changes.filter((c) => c.kind !== 'average-changed').length;

  return (
    <Screen title="Grades" refreshing={isRefetching} onRefresh={refetch}>
      {data.offline ? <Banner tone="warning" text={`Offline: showing grades from ${new Date(data.syncedAt).toLocaleString()}`} /> : null}
      {newGrades > 0 ? <Banner text={`${newGrades} new or updated grade${newGrades === 1 ? '' : 's'} since last check`} /> : null}

      {markingPeriods.length > 1 && selected ? (
        <Segmented
          options={markingPeriods.map((p) => ({ value: p.value, label: `MP ${p.label}` }))}
          value={selected}
          onChange={(v) => setPeriod(markingPeriods.find((p) => p.selected)?.value === v ? undefined : v)}
        />
      ) : null}

      <Card>
        <View style={styles.gpaRow}>
          <Stat label="Weighted GPA" value={gpa.weighted?.toFixed(3) ?? '—'} />
          <Stat label="Unweighted GPA" value={gpa.unweighted?.toFixed(3) ?? '—'} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          From current averages. Change the scale or course levels in Settings.
        </ThemedText>
      </Card>

      {courses.length === 0 ? <EmptyState title="No classes in this marking period" /> : null}

      {courses.map((c) => {
        const missing = c.assignments.filter((a) => a.isMissing).length;
        const mismatch = averageMismatch(c);
        return (
          <Card
            key={c.id}
            onPress={() => router.push({ pathname: '/class/[id]', params: { id: c.id, period: period ?? '' } })}>
            <View style={styles.courseRow}>
              <View style={styles.courseText}>
                <ThemedText type="smallBold" numberOfLines={2}>
                  {c.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {c.id} · {c.assignments.filter((a) => a.score !== null).length} graded
                </ThemedText>
              </View>
              <View style={styles.avg}>
                <ThemedText type="subtitle" style={{ color: gradeColor(c.reportedAverage, theme) }}>
                  {formatAverage(c.reportedAverage)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {letterGrade(c.reportedAverage)}
                </ThemedText>
              </View>
            </View>
            {missing > 0 || (mismatch !== null && mismatch !== 0) ? (
              <View style={styles.pills}>
                {missing > 0 ? <Pill label={`${missing} missing`} color={theme.danger} /> : null}
                {mismatch ? <Pill label="Average includes something hidden" color={theme.warning} /> : null}
              </View>
            ) : null}
          </Card>
        );
      })}

      <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
        Updated {new Date(data.syncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </ThemedText>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="subtitle">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  gpaRow: { flexDirection: 'row', gap: Spacing.three },
  stat: { flex: 1 },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  courseText: { flex: 1, gap: Spacing.half },
  avg: { alignItems: 'flex-end' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  footer: { textAlign: 'center' },
});
