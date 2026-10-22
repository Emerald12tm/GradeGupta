import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Banner,
  Card,
  EmptyState,
  ErrorState,
  GradeBadge,
  LoadingState,
  Pill,
  Screen,
  SectionHeader,
  Segmented,
  withAlpha,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useGrades } from '@/data/queries';
import { formatAverage } from '@/grades/average';
import { averageMismatch } from '@/grades/solver';
import type { CourseLevel } from '@/hac/types';
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
  const missingTotal = courses.reduce((n, c) => n + c.assignments.filter((a) => a.isMissing).length, 0);

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

      {/* Hero: GPA on the theme's accent color. */}
      <View style={[styles.hero, { backgroundColor: theme.tint }]}>
        <ThemedText type="caption" style={{ color: withAlpha(theme.onTint, 0.75) }}>
          Weighted GPA
        </ThemedText>
        <ThemedText type="title" style={{ color: theme.onTint, fontSize: 48, lineHeight: 54 }}>
          {gpa.weighted?.toFixed(3) ?? '—'}
        </ThemedText>
        <View style={styles.heroStats}>
          <HeroStat label="Unweighted" value={gpa.unweighted?.toFixed(3) ?? '—'} color={theme.onTint} />
          <HeroStat label="Classes" value={String(courses.length)} color={theme.onTint} />
          <HeroStat label="Missing" value={String(missingTotal)} color={theme.onTint} />
        </View>
      </View>

      {courses.length === 0 ? <EmptyState title="No classes in this marking period" icon="school-outline" /> : null}

      {courses.length > 0 ? <SectionHeader title="Classes" /> : null}
      {courses.map((c) => {
        const missing = c.assignments.filter((a) => a.isMissing).length;
        const mismatch = averageMismatch(c);
        return (
          <Card
            key={c.id}
            accessibilityLabel={`${c.name}, average ${formatAverage(c.reportedAverage)}`}
            onPress={() => router.push({ pathname: '/class/[id]', params: { id: c.id, period: period ?? '' } })}>
            <View style={styles.courseRow}>
              <View style={styles.courseText}>
                <ThemedText type="smallBold" numberOfLines={2} style={styles.courseName}>
                  {c.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {c.assignments.filter((a) => a.score !== null).length} graded · {LEVEL_LABEL[c.level]}
                </ThemedText>
                {missing > 0 || mismatch ? (
                  <View style={styles.pills}>
                    {missing > 0 ? <Pill icon="alert-circle" label={`${missing} missing`} color={theme.danger} /> : null}
                    {mismatch ? <Pill icon="eye-off" label="Hidden grade" color={theme.warning} /> : null}
                  </View>
                ) : null}
              </View>
              <GradeBadge average={c.reportedAverage} />
            </View>
          </Card>
        );
      })}

      <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
        Updated {new Date(data.syncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · pull down to refresh
      </ThemedText>
    </Screen>
  );
}

const LEVEL_LABEL: Record<CourseLevel, string> = {
  regular: 'Regular',
  honors: 'Honors',
  ap: 'AP',
  ib: 'IB',
  dual_credit: 'Dual credit',
};

function HeroStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.heroStat}>
      <ThemedText type="subtitle" style={{ color, fontSize: 20, lineHeight: 26 }}>
        {value}
      </ThemedText>
      <ThemedText type="small" style={{ color: withAlpha(color, 0.75) }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 24, padding: Spacing.four, gap: Spacing.one },
  heroStats: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
  heroStat: { flex: 1 },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  courseText: { flex: 1, gap: Spacing.one },
  courseName: { fontSize: 16, lineHeight: 22 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, marginTop: Spacing.half },
  footer: { textAlign: 'center' },
});
