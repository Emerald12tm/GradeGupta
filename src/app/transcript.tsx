import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Divider, ErrorState, ListRow, LoadingState, Screen, SectionHeader } from '@/components/ui';
import { useTranscript } from '@/data/queries';
import { computeGpa, detectLevel } from '@/grades/gpa';
import type { TranscriptCourse } from '@/hac/types';
import { gpaScaleFor, useSettings } from '@/settings/settings';

/**
 * Transcript: past courses by year, the official GPA/rank HAC reports, and a GPA computed
 * with your chosen scale (handy when HAC doesn't show GPA or uses a different formula).
 */
export default function TranscriptScreen() {
  const settings = useSettings();
  const { data, error, isLoading, isRefetching, refetch } = useTranscript();
  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  // Each semester grade counts for its share of the course's credits.
  const gpaInputs = data.courses.flatMap((c) => {
    const graded = c.semesters.filter((s): s is number => s !== null);
    const credits = c.credits ?? graded.length * 0.5;
    const override = settings.courseOverrides[c.name];
    if (override?.excludeFromGpa) return [];
    return graded.map((grade) => ({ grade, credits: credits / graded.length, level: override?.level ?? detectLevel(c.name) }));
  });
  const computed = computeGpa(gpaInputs, gpaScaleFor(settings));

  const years = new Map<string, TranscriptCourse[]>();
  for (const c of data.courses) years.set(c.year, [...(years.get(c.year) ?? []), c]);

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      {Object.keys(data.gpa).length > 0 || data.rank ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            From HAC
          </ThemedText>
          {Object.entries(data.gpa).map(([label, value]) => (
            <ListRow key={label} title={label} right={<ThemedText type="smallBold">{value.toFixed(4)}</ThemedText>} />
          ))}
          {data.rank ? <ListRow title="Class rank" right={<ThemedText type="smallBold">{data.rank}</ThemedText>} /> : null}
        </Card>
      ) : null}

      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Calculated with your GPA scale ({computed.credits} credits)
        </ThemedText>
        <ListRow title="Weighted" right={<ThemedText type="smallBold">{computed.weighted?.toFixed(4) ?? '—'}</ThemedText>} />
        <ListRow title="Unweighted" right={<ThemedText type="smallBold">{computed.unweighted?.toFixed(4) ?? '—'}</ThemedText>} />
      </Card>

      {[...years.entries()].map(([year, courses]) => (
        <View key={year}>
          <SectionHeader title={`${year}${courses[0]?.gradeLevel ? ` · Grade ${courses[0].gradeLevel}` : ''}`} />
          <Card>
            {courses.map((c, i) => (
              <View key={`${c.courseCode}-${i}`}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={c.name}
                  subtitle={c.credits !== null ? `${c.credits} credit` : undefined}
                  right={<ThemedText>{c.semesters.map((s) => s ?? '—').join(' / ')}</ThemedText>}
                />
              </View>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}
