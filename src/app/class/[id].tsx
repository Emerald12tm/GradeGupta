import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Sparkline } from '@/components/sparkline';
import { ThemedText } from '@/components/themed-text';
import {
  Banner,
  Button,
  Card,
  Collapsible,
  Divider,
  ErrorState,
  GradeBadge,
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
  withAlpha,
} from '@/components/ui';
import { gradeColor, Spacing, TINT_ALPHA } from '@/constants/theme';
import { useCourse, useCourseHistory, useSchedule } from '@/data/queries';
import { categoryImpact, formatAverage, formatScore } from '@/grades/average';
import { averageMismatch } from '@/grades/solver';
import { goalStatus } from '@/grades/planning';
import { requiredAssignmentScore } from '@/grades/target';
import { studyTips } from '@/grades/tips';
import { teacherMailto } from '@/integrations/report';
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
          <GradeBadge average={shown} size="large" />
          <View style={[styles.flex, styles.right]}>
            <ThemedText type="caption" themeColor="textSecondary">
              {whatIfOn && hasEdits(edits) ? 'What-if average' : 'Class average'}
            </ThemedText>
            {whatIfOn && result.delta !== null && hasEdits(edits) ? (
              <Pill
                icon={result.delta >= 0 ? 'trending-up' : 'trending-down'}
                label={`${result.delta >= 0 ? '+' : ''}${result.delta.toFixed(2)} vs HAC`}
                color={result.delta >= 0 ? theme.success : theme.danger}
              />
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {course.assignments.filter((a) => a.score !== null).length} graded assignments
              </ThemedText>
            )}
          </View>
        </View>
        {history.length > 1 ? <Sparkline values={history.map((h) => h.average)} reference={90} height={48} /> : null}
        <Divider />
        <ToggleRow
          icon="flask"
          title="What-if mode"
          subtitle={whatIfOn ? 'Tap a score below to change it' : 'Try scores without changing HAC'}
          value={whatIfOn}
          onChange={setWhatIfOn}
        />
        {whatIfOn && hasEdits(edits) ? (
          <Button title="Reset what-if changes" variant="secondary" icon="refresh" onPress={() => setEdits(emptyEdits())} />
        ) : null}
      </Card>

      {mismatch ? (
        <Card onPress={() => router.push({ pathname: '/calculator', params: { mode: 'hidden', course: course.id, period: period ?? '' } })}>
          <ListRow
            icon="eye-off"
            iconColor={theme.warning}
            title="A grade may be hidden"
            subtitle={`HAC shows ${formatAverage(course.reportedAverage)}, posted work adds up to ${formatAverage((course.reportedAverage ?? 0) - mismatch)}. Tap to find it.`}
          />
        </Card>
      ) : null}

      {whatIfOn ? <AddHypothetical course={course} onAdd={(a) => setEdits((e) => ({ ...e, added: [...e.added, a] }))} /> : null}

      <Collapsible
        title="Categories"
        icon="pie-chart"
        summary={
          <View style={styles.categoryChips}>
            {result.categories.map((c) => (
              <ThemedText key={c.name} type="small" numberOfLines={1}>
                <ThemedText type="small" themeColor="textSecondary">
                  {c.name}{' '}
                </ThemedText>
                <ThemedText type="smallBold" style={{ color: gradeColor(c.average, theme) }}>
                  {c.average === null ? '—' : c.average.toFixed(1)}
                </ThemedText>
              </ThemedText>
            ))}
          </View>
        }>
        {result.categories.map((c) => (
          <View key={c.name} style={styles.categoryRow}>
            <View style={styles.flex}>
              <ThemedText type="small">{c.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {c.weight}% of grade
                {c.effectiveWeight && Math.abs(c.effectiveWeight - c.weight) > 0.01 ? ` · counts ${c.effectiveWeight.toFixed(0)}% for now` : ''}
              </ThemedText>
            </View>
            <ThemedText type="smallBold" style={{ color: gradeColor(c.average, theme) }}>
              {formatAverage(c.average)}
            </ThemedText>
          </View>
        ))}
        {categoryImpact(result)[0]?.pointsLost > 0.5 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {categoryImpact(result)[0].name} costs you the most: {categoryImpact(result)[0].pointsLost.toFixed(2)} points.
          </ThemedText>
        ) : null}
      </Collapsible>

      <WhatDoINeed course={course} />
      <GoalSection course={course} />
      <TipsSection course={course} />
      <TeacherRow course={course} />

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
    <View style={[styles.assignment, (override !== undefined || dropped) && [styles.edited, { backgroundColor: withAlpha(theme.tint, TINT_ALPHA) }]]}>
      <View style={styles.flex}>
        <ThemedText numberOfLines={2} style={dropped ? styles.dropped : undefined}>{a.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
        <View style={styles.pills}>
          {a.isMissing ? <Pill icon="alert-circle" label="Missing" color={theme.danger} /> : null}
          {a.score === null ? <Pill label="Not graded" /> : null}
          {a.totalPoints === 0 && a.score !== null ? <Pill icon="add-circle" label="Extra credit" color={theme.success} /> : null}
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
            accessibilityLabel={
              a.totalPoints === 0 ? `What-if extra credit points for ${a.name}` : `What-if score for ${a.name}, out of ${a.totalPoints}`
            }
            style={[styles.scoreInput, { color: theme.text, borderColor: override !== undefined ? theme.tint : theme.track, backgroundColor: theme.background }]}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {a.totalPoints === 0 ? 'bonus pts' : `/ ${a.totalPoints}`}
          </ThemedText>
          <Pressable onPress={onToggleDrop} accessibilityRole="button">
            <ThemedText type="small" style={{ color: theme.tint }}>
              {dropped ? 'Undrop' : 'Drop'}
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.right}>
          <ThemedText type="smallBold" style={{ color: a.totalPoints === 0 && a.score !== null ? theme.success : gradeColor(pct, theme) }}>
            {formatScore(a)}
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
    <Collapsible title="Add a made-up assignment" icon="add-circle" summary="Score, points and category" defaultOpen>
      {course.categories.length > 1 ? (
        <Segmented options={course.categories.map((c) => ({ value: c.name, label: c.name }))} value={category} onChange={setCategory} />
      ) : null}
      <TextField label="Name (optional)" value={name} onChangeText={setName} placeholder="Next test" />
      <View style={styles.twoCol}>
        <View style={styles.flex}>
          <NumberField label="Score" value={score} onChangeText={setScore} placeholder="85" />
        </View>
        <View style={styles.flex}>
          <NumberField label="Out of" value={total} onChangeText={setTotal} hint="0 = extra credit" />
        </View>
      </View>
      <Button
        title="Add"
        icon="add"
        disabled={s === null || t === null}
        onPress={() => {
          onAdd({ id: `mock-${Date.now()}`, name: name || 'Hypothetical', category, score: s, totalPoints: t ?? 100, isMock: true });
          setScore('');
          setName('');
        }}
      />
    </Collapsible>
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
  let short = '';
  if (needed === null) {
    answer = `Even a perfect score won’t get you to ${t} with one assignment.`;
    short = `${t} isn’t reachable with one assignment`;
  } else if (needed === 0) {
    answer = `You’re already at ${t} or above whatever you score.`;
    short = `You’re safe for ${t}`;
  } else if (needed !== undefined && p) {
    answer = `You need ${needed.toFixed(1)}% (${((needed / 100) * p).toFixed(1)}/${p}) on the next ${category.toLowerCase()} assignment.`;
    short = `${needed.toFixed(0)}% on the next ${category.toLowerCase()} for a ${t}`;
  }

  return (
    <Collapsible title="What do I need?" icon="flag" summary={short}>
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
    </Collapsible>
  );
}

const GOALS = [
  { value: 'none', label: 'None' },
  { value: '70', label: '70' },
  { value: '80', label: '80' },
  { value: '90', label: '90' },
  { value: '95', label: '95' },
] as const;

/** Target grade for this class; alerts in the background when the class slips below it. */
function GoalSection({ course }: { course: Course }) {
  const theme = useTheme();
  const settings = useSettings();
  const setOverride = useSettingsStore((s) => s.setCourseOverride);
  const goal = settings.courseOverrides[course.name]?.goal;
  const status = goal !== undefined ? goalStatus(course, goal) : null;

  let summary = 'Set a target and get alerts if you slip below it';
  if (status) {
    summary = status.met
      ? `On track: ${status.gap.toFixed(1)} above your goal of ${goal}`
      : status.nextNeeded === null
        ? `${Math.abs(status.gap).toFixed(1)} below ${goal}. Out of reach with one assignment`
        : `${Math.abs(status.gap).toFixed(1)} below ${goal}. Need ${status.nextNeeded.toFixed(0)}% on the next ${status.category?.toLowerCase()} grade`;
  }

  return (
    <Collapsible title="Goal" icon={status?.met === false ? 'flag' : 'flag-outline'} summary={summary}>
      <Segmented
        options={GOALS.map((g) => ({ value: g.value, label: g.label }))}
        value={goal === undefined ? 'none' : (GOALS.find((g) => g.value === String(goal))?.value ?? 'none')}
        onChange={(v) => void setOverride(course.name, { goal: v === 'none' ? undefined : Number(v) })}
      />
      {status ? (
        <ThemedText type="small" style={{ color: status.met ? theme.success : theme.warning }}>
          {summary}.
        </ThemedText>
      ) : null}
    </Collapsible>
  );
}

function TipsSection({ course }: { course: Course }) {
  const tips = useMemo(() => studyTips(course), [course]);
  if (tips.length === 0) return null;
  return (
    <Collapsible title="Tips" icon="bulb" summary={tips[0].text}>
      {tips.map((t, i) => (
        <ThemedText key={i} type="small">
          • {t.text}
        </ThemedText>
      ))}
    </Collapsible>
  );
}

/** Quick email to the teacher, when the schedule lists their address. */
function TeacherRow({ course }: { course: Course }) {
  const schedule = useSchedule().data ?? [];
  const entry = schedule.find((s) => s.courseCode === course.id) ?? schedule.find((s) => s.name.toLowerCase() === course.name.toLowerCase());
  if (!entry?.teacherEmail) return null;
  const email = entry.teacherEmail;
  return (
    <Card onPress={() => void Linking.openURL(teacherMailto(email, course.name))}>
      <ListRow icon="mail" title={`Email ${entry.teacher || 'teacher'}`} subtitle={email} />
    </Card>
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

  const credits = override.credits ?? course.credits;
  const summary = override.excludeFromGpa
    ? 'Left out of GPA'
    : `${LEVELS.find((l) => l.value === (level === 'ib' ? 'ap' : level))?.label} · ${credits} credit`;

  return (
    <Collapsible title="GPA settings for this class" icon="school" summary={summary}>
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
    </Collapsible>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  right: { alignItems: 'flex-end' },
  assignment: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.one },
  dropped: { textDecorationLine: 'line-through', opacity: 0.7 },
  edited: { borderRadius: 12, paddingHorizontal: Spacing.two, marginHorizontal: -Spacing.two },
  pills: { flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap' },
  editCol: { alignItems: 'flex-end', gap: Spacing.one },
  scoreInput: { width: 84, minHeight: 44, borderWidth: 1.5, borderRadius: 10, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  twoCol: { flexDirection: 'row', gap: Spacing.three },
});
