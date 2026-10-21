import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Sparkline } from '@/components/sparkline';
import { ThemedText } from '@/components/themed-text';
import {
  Banner,
  Button,
  Card,
  Divider,
  ErrorState,
  ListRow,
  LoadingState,
  NumberField,
  Pill,
  Screen,
  SectionHeader,
  Segmented,
  TextField,
  ToggleRow,
  toNumber,
} from '@/components/ui';
import { gradeColor, Spacing } from '@/constants/theme';
import { useCourse, useCourseHistory } from '@/data/queries';
import { categoryImpact, formatAverage, letterGrade } from '@/grades/average';
import { averageMismatch } from '@/grades/solver';
import { requiredAssignmentScore } from '@/grades/target';
import { emptyEdits, hasEdits, whatIf, type WhatIfEdits } from '@/grades/whatif';
import type { Assignment, Course, CourseLevel } from '@/hac/types';
import { useTheme } from '@/hooks/use-theme';
import { useSettings, useSettingsStore } from '@/settings/settings';

/**
 * One class: average, category breakdown, assignments, what-if mode, "what do I need",
 * trend chart and GPA settings for the class.
 */
export default function ClassScreen() {
  const { id, period } = useLocalSearchParams<{ id: string; period?: string }>();
  const { course, isLoading, error, refetch } = useCourse(id, period || undefined);

  if (isLoading) return <LoadingState />;
  if (!course) return <ErrorState error={error ?? new Error('This class isn’t in the selected marking period.')} onRetry={refetch} />;
  return <ClassDetail course={course} period={period} />;
}

function ClassDetail({ course, period }: { course: Course; period?: string }) {
  const theme = useTheme();
  const [whatIfOn, setWhatIfOn] = useState(false);
  const [edits, setEdits] = useState<WhatIfEdits>(emptyEdits);
  const result = useMemo(() => whatIf(course, whatIfOn ? edits : emptyEdits()), [course, edits, whatIfOn]);
  const shown = whatIfOn && hasEdits(edits) ? result.average : course.reportedAverage;
  const mismatch = averageMismatch(course);
  const history = useCourseHistory(course.id).data ?? [];

  const sorted = [...course.assignments].sort((a, b) => (b.dateDue ?? '').localeCompare(a.dateDue ?? ''));

  return (
    <Screen>
      <Stack.Screen options={{ title: course.name }} />

      <Card>
        <View style={styles.summary}>
          <View style={styles.flex}>
            <ThemedText type="small" themeColor="textSecondary">
              {whatIfOn && hasEdits(edits) ? 'What-if average' : 'Average'}
            </ThemedText>
            <ThemedText type="title" style={{ color: gradeColor(shown, theme) }}>
              {formatAverage(shown)}
            </ThemedText>
          </View>
          <View style={styles.right}>
            <ThemedText type="subtitle">{letterGrade(shown)}</ThemedText>
            {whatIfOn && result.delta !== null && hasEdits(edits) ? (
              <ThemedText style={{ color: result.delta >= 0 ? theme.success : theme.danger }}>
                {result.delta >= 0 ? '+' : ''}
                {result.delta.toFixed(2)}
              </ThemedText>
            ) : null}
          </View>
        </View>
        {history.length > 1 ? <Sparkline values={history.map((h) => h.average)} reference={90} /> : null}
      </Card>

      {mismatch ? (
        <Card>
          <ThemedText type="smallBold">The average doesn’t match the visible assignments</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            HAC shows {formatAverage(course.reportedAverage)} but the posted grades work out to{' '}
            {formatAverage((course.reportedAverage ?? 0) - mismatch)}. Usually that means the teacher has already counted a
            grade, often the final exam, that isn’t posted yet.
          </ThemedText>
          <Button
            title="Figure out the hidden grade"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/calculator', params: { mode: 'hidden', course: course.id, period: period ?? '' } })
            }
          />
        </Card>
      ) : null}

      <Card>
        <ToggleRow
          title="What-if mode"
          subtitle="Change scores, drop assignments or add made-up ones. Nothing is sent to HAC."
          value={whatIfOn}
          onChange={setWhatIfOn}
        />
        {whatIfOn && hasEdits(edits) ? <Button title="Reset changes" variant="secondary" onPress={() => setEdits(emptyEdits())} /> : null}
      </Card>

      {whatIfOn ? <AddHypothetical course={course} onAdd={(a) => setEdits((e) => ({ ...e, added: [...e.added, a] }))} /> : null}

      <SectionHeader title="Categories" />
      <Card>
        {result.categories.map((c, i) => (
          <View key={c.name}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              title={c.name}
              subtitle={`Weight ${c.weight}%${c.effectiveWeight && Math.abs(c.effectiveWeight - c.weight) > 0.01 ? ` (counts ${c.effectiveWeight.toFixed(1)}% until every category has grades)` : ''}`}
              right={<ThemedText style={{ color: gradeColor(c.average, theme) }}>{formatAverage(c.average)}</ThemedText>}
            />
          </View>
        ))}
        {categoryImpact(result)[0]?.pointsLost > 0.5 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {categoryImpact(result)[0].name} is costing you the most: {categoryImpact(result)[0].pointsLost.toFixed(2)} points.
          </ThemedText>
        ) : null}
      </Card>

      <WhatDoINeed course={course} />

      <SectionHeader title={`Assignments (${course.assignments.length})`} />
      <Card>
        {sorted.length === 0 ? <ThemedText themeColor="textSecondary">No assignments yet.</ThemedText> : null}
        {sorted.map((a, i) => (
          <View key={a.id}>
            {i > 0 ? <Divider /> : null}
            <AssignmentRow
              assignment={a}
              whatIf={whatIfOn}
              override={edits.overrides[a.id]}
              dropped={edits.dropped.includes(a.id)}
              onOverride={(score) =>
                setEdits((e) => {
                  const overrides = { ...e.overrides };
                  if (score === undefined) delete overrides[a.id];
                  else overrides[a.id] = score;
                  return { ...e, overrides };
                })
              }
              onToggleDrop={() =>
                setEdits((e) => ({
                  ...e,
                  dropped: e.dropped.includes(a.id) ? e.dropped.filter((x) => x !== a.id) : [...e.dropped, a.id],
                }))
              }
            />
          </View>
        ))}
        {edits.added.map((a) => (
          <View key={a.id}>
            <Divider />
            <ListRow
              title={`${a.name} (what-if)`}
              subtitle={a.category}
              right={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${a.name}`}
                  onPress={() => setEdits((e) => ({ ...e, added: e.added.filter((x) => x.id !== a.id) }))}>
                  <ThemedText style={{ color: theme.tint }}>
                    {a.score}/{a.totalPoints} ✕
                  </ThemedText>
                </Pressable>
              }
            />
          </View>
        ))}
      </Card>

      <CourseGpaSettings course={course} />
    </Screen>
  );
}

function AssignmentRow({
  assignment: a,
  whatIf: editable,
  override,
  dropped,
  onOverride,
  onToggleDrop,
}: {
  assignment: Assignment;
  whatIf: boolean;
  override: number | null | undefined;
  dropped: boolean;
  onOverride: (score: number | null | undefined) => void;
  onToggleDrop: () => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState(override !== undefined && override !== null ? String(override) : '');
  const pct = a.score !== null && a.totalPoints > 0 ? (a.score / a.totalPoints) * 100 : null;
  const subtitle = [a.category, a.dateDue && new Date(`${a.dateDue}T12:00:00`).toLocaleDateString(), a.weight && a.weight !== 1 ? `×${a.weight}` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.assignment, dropped && styles.dropped]}>
      <View style={styles.flex}>
        <ThemedText numberOfLines={2}>{a.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
        <View style={styles.pills}>
          {a.isMissing ? <Pill label="Missing" color={theme.danger} /> : null}
          {a.score === null ? <Pill label="Not graded" /> : null}
        </View>
      </View>
      {editable ? (
        <View style={styles.editCol}>
          <TextInput
            value={text}
            onChangeText={(t) => {
              const clean = t.replace(/[^0-9.]/g, '');
              setText(clean);
              onOverride(clean === '' ? undefined : toNumber(clean));
            }}
            placeholder={a.score === null ? '—' : String(a.score)}
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            accessibilityLabel={`What-if score for ${a.name}, out of ${a.totalPoints}`}
            style={[styles.scoreInput, { color: theme.text, borderColor: theme.border }]}
          />
          <ThemedText type="small" themeColor="textSecondary">
            / {a.totalPoints}
          </ThemedText>
          <Pressable onPress={onToggleDrop} accessibilityRole="button">
            <ThemedText type="small" style={{ color: theme.tint }}>
              {dropped ? 'Undrop' : 'Drop'}
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.right}>
          <ThemedText style={{ color: gradeColor(pct, theme) }}>
            {a.score === null ? '—' : `${a.score}/${a.totalPoints}`}
          </ThemedText>
          {pct !== null && a.totalPoints !== 100 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {pct.toFixed(1)}%
            </ThemedText>
          ) : null}
        </View>
      )}
    </View>
  );
}

function AddHypothetical({ course, onAdd }: { course: Course; onAdd: (a: Assignment) => void }) {
  const [category, setCategory] = useState(course.categories[0]?.name ?? '');
  const [score, setScore] = useState('');
  const [total, setTotal] = useState('100');
  const [name, setName] = useState('');
  const s = toNumber(score);
  const t = toNumber(total);

  return (
    <Card>
      <ThemedText type="smallBold">Add a made-up assignment</ThemedText>
      {course.categories.length > 1 ? (
        <Segmented options={course.categories.map((c) => ({ value: c.name, label: c.name }))} value={category} onChange={setCategory} />
      ) : null}
      <TextField label="Name (optional)" value={name} onChangeText={setName} placeholder="Next test" />
      <View style={styles.twoCol}>
        <View style={styles.flex}>
          <NumberField label="Score" value={score} onChangeText={setScore} placeholder="85" />
        </View>
        <View style={styles.flex}>
          <NumberField label="Out of" value={total} onChangeText={setTotal} />
        </View>
      </View>
      <Button
        title="Add"
        disabled={s === null || !t}
        onPress={() => {
          onAdd({ id: `mock-${Date.now()}`, name: name || 'Hypothetical', category, score: s, totalPoints: t ?? 100, isMock: true });
          setScore('');
          setName('');
        }}
      />
    </Card>
  );
}

function WhatDoINeed({ course }: { course: Course }) {
  const [target, setTarget] = useState('90');
  const [category, setCategory] = useState(course.categories[0]?.name ?? '');
  const [points, setPoints] = useState('100');
  const t = toNumber(target);
  const p = toNumber(points);
  const needed = t !== null && p ? requiredAssignmentScore(course, category, p, t) : undefined;

  let answer = '';
  if (needed === null) answer = `Even a perfect score won’t get you to ${t} with one assignment.`;
  else if (needed === 0) answer = `You’re already at ${t} or above whatever you score.`;
  else if (needed !== undefined && p)
    answer = `You need ${needed.toFixed(1)}% (${((needed / 100) * p).toFixed(1)}/${p}) on the next ${category.toLowerCase()} assignment.`;

  return (
    <>
      <SectionHeader title="What do I need?" />
      <Card>
        {course.categories.length > 1 ? (
          <Segmented options={course.categories.map((c) => ({ value: c.name, label: c.name }))} value={category} onChange={setCategory} />
        ) : null}
        <View style={styles.twoCol}>
          <View style={styles.flex}>
            <NumberField label="Target average" value={target} onChangeText={setTarget} />
          </View>
          <View style={styles.flex}>
            <NumberField label="Assignment worth" value={points} onChangeText={setPoints} />
          </View>
        </View>
        {answer ? <Banner text={answer} /> : null}
      </Card>
    </>
  );
}

const LEVELS: { value: CourseLevel; label: string }[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'honors', label: 'Honors' },
  { value: 'ap', label: 'AP' },
  { value: 'dual_credit', label: 'DC' },
];

function CourseGpaSettings({ course }: { course: Course }) {
  const settings = useSettings();
  const setOverride = useSettingsStore((s) => s.setCourseOverride);
  const override = settings.courseOverrides[course.name] ?? {};
  const level = override.level ?? course.level;

  return (
    <>
      <SectionHeader title="GPA settings for this class" />
      <Card>
        <Segmented options={LEVELS} value={level === 'ib' ? 'ap' : level} onChange={(v) => void setOverride(course.name, { level: v })} />
        <Segmented
          options={[
            { value: '1', label: '1 credit' },
            { value: '0.5', label: '0.5 credit' },
          ]}
          value={String(override.credits ?? course.credits) === '0.5' ? '0.5' : '1'}
          onChange={(v) => void setOverride(course.name, { credits: Number(v) })}
        />
        <ToggleRow
          title="Leave out of GPA"
          value={!!override.excludeFromGpa}
          onChange={(v) => void setOverride(course.name, { excludeFromGpa: v })}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Used for your GPA on the Grades tab.
        </ThemedText>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'flex-end' },
  right: { alignItems: 'flex-end' },
  assignment: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  dropped: { opacity: 0.4 },
  pills: { flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap' },
  editCol: { alignItems: 'flex-end', gap: Spacing.one },
  scoreInput: { width: 72, minHeight: 40, borderWidth: 1, borderRadius: 8, textAlign: 'center', fontSize: 16 },
  twoCol: { flexDirection: 'row', gap: Spacing.three },
});
