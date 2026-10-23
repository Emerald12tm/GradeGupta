import { router } from 'expo-router';
import { View } from 'react-native';

import { Sparkline } from '@/components/sparkline';
import { ThemedText } from '@/components/themed-text';
import { Card, Divider, EmptyState, ListRow, Screen, SectionHeader } from '@/components/ui';
import { gradeColor } from '@/constants/theme';
import { useCourseHistory, useGpaHistory, useGrades, useTranscript } from '@/data/queries';
import { categoryImpact, computeAverage, formatAverage } from '@/grades/average';
import { requiredAssignmentScore } from '@/grades/target';
import { studyTips } from '@/grades/tips';
import { useTheme } from '@/hooks/use-theme';
import type { HistoryPoint } from '@/storage/db';

/**
 * Insights tab: built from the history the app records on every sync (on this device only).
 * GPA trend, biggest movers this week, what's hurting each grade, and how close you are
 * to the next letter grade.
 */

const WEEK = 7 * 24 * 60 * 60_000;

/** Change in each course's average over the last week, biggest first. */
function movers(history: HistoryPoint[]) {
  const byCourse = new Map<string, HistoryPoint[]>();
  for (const h of history) byCourse.set(h.courseId, [...(byCourse.get(h.courseId) ?? []), h]);
  const cutoff = Date.now() - WEEK;
  return [...byCourse.values()]
    .map((points) => {
      const latest = points[points.length - 1];
      const baseline = [...points].reverse().find((p) => new Date(p.takenAt).getTime() <= cutoff) ?? points[0];
      return { courseId: latest.courseId, name: latest.courseName, delta: latest.average - baseline.average, points };
    })
    .filter((m) => Math.abs(m.delta) >= 0.01)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export default function InsightsScreen() {
  const theme = useTheme();
  const grades = useGrades();
  const gpa = useGpaHistory();
  const history = useCourseHistory();
  const courses = grades.data?.page.courses ?? [];
  const weighted = (gpa.data ?? []).map((p) => p.weighted).filter((v): v is number => v !== null);
  const moved = movers(history.data ?? []);
  const transcript = useTranscript().data;
  // The highest-impact tip from each class, biggest first.
  const tips = courses
    .flatMap((course) => {
      const tip = studyTips(course)[0];
      return tip ? [{ course, tip }] : [];
    })
    .sort((a, b) => b.tip.points - a.tip.points);

  const refresh = () => {
    void grades.refetch().then(() => {
      void gpa.refetch();
      void history.refetch();
    });
  };

  return (
    <Screen title="Insights" refreshing={grades.isRefetching} onRefresh={refresh}>
      <Card>
        <ListRow icon="trending-up" title="GPA planner" subtitle="Your GPA if you finish with these grades" onPress={() => router.push('/gpa-planner')} />
        <Divider />
        <ListRow icon="school" title="Final exam planner" subtitle="Score needed on every final" onPress={() => router.push('/finals')} />
        <Divider />
        <ListRow icon="git-compare" title="Compare marking periods" onPress={() => router.push('/compare')} />
        {transcript?.rank ? (
          <>
            <Divider />
            <ListRow icon="podium" title="Class rank" subtitle="As reported on your HAC transcript" right={<ThemedText type="smallBold">{transcript.rank}</ThemedText>} />
          </>
        ) : null}
      </Card>

      {tips.length > 0 ? (
        <>
          <SectionHeader title="Top tips" />
          <Card>
            {tips.slice(0, 4).map(({ course, tip }, i) => (
              <View key={course.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  icon="bulb"
                  iconColor={theme.warning}
                  title={course.name}
                  subtitle={tip.text}
                  onPress={() => router.push({ pathname: '/class/[id]', params: { id: course.id } })}
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="GPA over time" />
      <Card>
        {weighted.length > 1 ? (
          <>
            <ThemedText type="subtitle">{weighted[weighted.length - 1].toFixed(3)}</ThemedText>
            <Sparkline values={weighted} />
            <ThemedText type="small" themeColor="textSecondary">
              Weighted GPA from your current averages, recorded each time grades change.
            </ThemedText>
          </>
        ) : (
          <EmptyState title="Not enough history yet" message="GradeGupta records your grades every time it checks HAC. Trends show up after a few changes." />
        )}
      </Card>

      {moved.length > 0 ? (
        <>
          <SectionHeader title="Biggest changes this week" />
          <Card>
            {moved.slice(0, 5).map((m, i) => (
              <View key={m.courseId}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={m.name}
                  right={
                    <ThemedText style={{ color: m.delta >= 0 ? theme.success : theme.danger }}>
                      {m.delta >= 0 ? '▲' : '▼'} {Math.abs(m.delta).toFixed(2)}
                    </ThemedText>
                  }
                  onPress={() => router.push({ pathname: '/class/[id]', params: { id: m.courseId } })}
                />
                <Sparkline values={m.points.map((p) => p.average)} height={36} />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Closest to the next letter grade" />
      <Card>
        {courses
          .filter((c) => c.reportedAverage !== null && c.reportedAverage < 90)
          .map((c) => {
            const next = Math.min(90, (Math.floor((c.reportedAverage as number) / 10) + 1) * 10);
            const major = c.categories.slice().sort((a, b) => b.weight - a.weight)[0]?.name ?? '';
            const need = requiredAssignmentScore(c, major, 100, next - 0.5);
            return { c, next, major, need, gap: next - (c.reportedAverage as number) };
          })
          .sort((a, b) => a.gap - b.gap)
          .map(({ c, next, major, need }, i) => (
            <View key={c.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={c.name}
                subtitle={
                  need === null
                    ? `${next} isn’t reachable with one ${major.toLowerCase()} grade`
                    : `A ${need.toFixed(0)} on the next 100-point ${major.toLowerCase()} assignment gets you to ${next}`
                }
                right={<ThemedText style={{ color: gradeColor(c.reportedAverage, theme) }}>{formatAverage(c.reportedAverage)}</ThemedText>}
                onPress={() => router.push({ pathname: '/class/[id]', params: { id: c.id } })}
              />
            </View>
          ))}
        {courses.every((c) => c.reportedAverage === null || c.reportedAverage >= 90) ? (
          <ThemedText themeColor="textSecondary">Every class is an A. Nice.</ThemedText>
        ) : null}
      </Card>

      <SectionHeader title="What’s costing you points" />
      <Card>
        {courses
          .map((c) => ({ c, worst: categoryImpact(computeAverage(c.categories, c.assignments))[0] }))
          .filter(({ worst }) => worst && worst.pointsLost >= 0.5)
          .map(({ c, worst }, i) => (
            <View key={c.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow title={c.name} subtitle={`${worst.name} costs you ${worst.pointsLost.toFixed(2)} points`} />
            </View>
          ))}
      </Card>
    </Screen>
  );
}
