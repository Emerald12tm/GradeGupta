import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Banner, Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useGrades, useReportCard } from '@/data/queries';
import { finalsPlan } from '@/grades/planning';
import { normalizeWeights } from '@/grades/semester';
import { useTheme } from '@/hooks/use-theme';
import { semesterWeightsFor, useSettings } from '@/settings/settings';

/**
 * Final exam planner: every class at once, with the exam score needed to finish the
 * semester with an A, B or C. Uses report card grades, and the live class average for the
 * grading period that hasn't been posted yet.
 */
export default function FinalsScreen() {
  const theme = useTheme();
  const settings = useSettings();
  const weights = semesterWeightsFor(settings);
  const reportCard = useReportCard();
  const grades = useGrades();

  if (reportCard.isLoading) return <LoadingState />;
  if (!reportCard.data) return <ErrorState error={reportCard.error} onRetry={reportCard.refetch} />;

  const live: Record<string, number> = {};
  for (const c of grades.data?.page.courses ?? []) if (c.reportedAverage !== null) live[c.name.toLowerCase()] = c.reportedAverage;
  const plans = finalsPlan(reportCard.data, weights, live);
  const n = normalizeWeights(weights);

  const cell = (need: number) => {
    if (need <= 0) return { text: 'Safe', color: theme.success };
    if (need > 100) return { text: 'Out of reach', color: theme.danger };
    return { text: need.toFixed(0), color: need >= 90 ? theme.warning : theme.text };
  };

  return (
    <Screen>
      <Banner
        text={`Semester = ${n.periods.map((p) => `${Math.round(p * 100)}%`).join(' + ')} grading periods + ${Math.round(n.exam * 100)}% final. Change it in Settings.`}
      />
      {plans.length === 0 ? (
        <EmptyState title="No current semester found" message="Your report card doesn’t have grading period grades for an unfinished semester yet." />
      ) : null}
      {plans.map((p) => (
        <Card key={p.course} onPress={() => router.push('/calculator')}>
          <ThemedText type="smallBold">{p.course}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {p.periods.map((g, i) => `P${i + 1} ${g.grade.toFixed(1)}${g.estimated ? ' (now)' : ''}`).join(' · ')}
          </ThemedText>
          <View style={styles.cells}>
            {(['A', 'B', 'C'] as const).map((letter) => {
              const c = cell(p.needFor[letter]);
              return (
                <View key={letter} style={[styles.cell, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <ThemedText type="caption" themeColor="textSecondary">
                    Final for {letter}
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ color: c.color, fontSize: 18, lineHeight: 24 }}>
                    {c.text}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </Card>
      ))}
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        “(now)” means that grading period isn’t posted yet, so your current class average is used. Estimates only.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cells: { flexDirection: 'row', gap: Spacing.two },
  cell: { flex: 1, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing.two, alignItems: 'center', gap: 2 },
  note: { textAlign: 'center' },
});
