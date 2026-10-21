import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Banner, Card, Divider, ListRow, NumberField, Screen, SectionHeader, Segmented, toNumber } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useGrades, useReportCard } from '@/data/queries';
import { formatAverage } from '@/grades/average';
import {
  examScoreFromSemester,
  impliedPeriodGrade,
  normalizeWeights,
  requiredExamScore,
  SEMESTER_PRESETS,
  type Rounding,
  type ScoreRange,
  type SemesterWeights,
} from '@/grades/semester';
import { solveHiddenAssignment } from '@/grades/solver';
import { semesterColumns } from '@/hac/parsers/pages';
import type { Course } from '@/hac/types';
import { useTheme } from '@/hooks/use-theme';
import { semesterWeightsFor, useSettings, useSettingsStore } from '@/settings/settings';

/**
 * Final exam / semester calculator.
 *
 * - Before the final:  exam score needed for a target semester grade.
 * - After the final:   the exam score you got, worked out from the posted semester grade.
 * - Hidden grade:      for teachers who fold the exam (or other grades) into an average before
 *                      posting it: solve for that test score from the class average or from
 *                      the semester grade.
 *
 * All math lives in `src/grades/semester.ts` and `src/grades/solver.ts`.
 */

type Mode = 'before' | 'after' | 'hidden';

export default function CalculatorScreen() {
  const params = useLocalSearchParams<{ mode?: Mode; course?: string; period?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode ?? 'before');
  const settings = useSettings();
  const weights = semesterWeightsFor(settings);

  // Grade inputs are shared across modes so switching modes keeps what you typed.
  const [periods, setPeriods] = useState<string[]>(['', '', '']);
  const [exam, setExam] = useState('');
  const [semester, setSemester] = useState('');

  const fill = (values: { periods: string[]; exam?: string; semester?: string }) => {
    setPeriods([...values.periods, '', '', ''].slice(0, 3));
    setExam(values.exam ?? '');
    setSemester(values.semester ?? '');
  };

  return (
    <Screen>
      <Segmented
        options={[
          { value: 'before', label: 'Before final' },
          { value: 'after', label: 'After final' },
          { value: 'hidden', label: 'Hidden grade' },
        ]}
        value={mode}
        onChange={setMode}
      />

      <FormulaPicker weights={weights} />
      <ReportCardFill onFill={fill} />

      {mode === 'before' ? <BeforeFinal weights={weights} periods={periods} setPeriods={setPeriods} /> : null}
      {mode === 'after' ? (
        <AfterFinal weights={weights} periods={periods} setPeriods={setPeriods} semester={semester} setSemester={setSemester} />
      ) : null}
      {mode === 'hidden' ? (
        <HiddenGrade
          weights={weights}
          periods={periods}
          setPeriods={setPeriods}
          exam={exam}
          setExam={setExam}
          semester={semester}
          setSemester={setSemester}
          initialCourse={params.course}
          marking={params.period || undefined}
        />
      ) : null}
    </Screen>
  );
}

// ---------- shared pieces ----------

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const shortLabel = (w: SemesterWeights) => {
  const n = normalizeWeights(w);
  return `${n.periods.map(pct).join(' / ')} + ${pct(n.exam)}`;
};

function FormulaPicker({ weights }: { weights: SemesterWeights }) {
  const theme = useTheme();
  const update = useSettingsStore((s) => s.update);
  const current = useSettings().semesterPreset;
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button">
        <ThemedText type="small" themeColor="textSecondary">
          Semester formula (tap to change)
        </ThemedText>
        <ThemedText type="smallBold">
          {weights.periods.length} grading periods {shortLabel(weights)} exam
        </ThemedText>
      </Pressable>
      {open
        ? SEMESTER_PRESETS.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() => {
                void update({ semesterPreset: p.id });
                setOpen(false);
              }}>
              <ThemedText style={{ color: p.id === current ? theme.tint : theme.text }}>{p.label}</ThemedText>
            </Pressable>
          ))
        : null}
      {open ? (
        <ThemedText type="small" themeColor="textSecondary">
          Custom weights: Settings → Semester formula.
        </ThemedText>
      ) : null}
    </Card>
  );
}

/** Lets the user pick a class + semester from the HAC report card to pre-fill the inputs. */
function ReportCardFill({ onFill }: { onFill: (v: { periods: string[]; exam?: string; semester?: string }) => void }) {
  const { data } = useReportCard();
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => (data ? semesterColumns(data.headers) : []), [data]);
  if (!data || groups.length === 0 || data.rows.length === 0) return null;

  return (
    <Card>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button">
        <ThemedText type="smallBold">Fill in from my report card {open ? '▴' : '▾'}</ThemedText>
      </Pressable>
      {open
        ? data.rows.map((row, i) =>
            groups.map((g, s) => {
              const values = g.periods.map((h) => row[h] ?? '');
              if (values.every((v) => !v)) return null;
              return (
                <View key={`${i}-${s}`}>
                  <Divider />
                  <ListRow
                    title={`${row.Description ?? row.Course} · Semester ${s + 1}`}
                    subtitle={`${g.periods.map((h) => `${h} ${row[h] || '—'}`).join('  ')}${g.exam ? `  ${g.exam} ${row[g.exam] || '—'}` : ''}  ${g.semester} ${row[g.semester] || '—'}`}
                    onPress={() => {
                      onFill({ periods: values, exam: g.exam ? row[g.exam] : '', semester: row[g.semester] });
                      setOpen(false);
                    }}
                  />
                </View>
              );
            }),
          )
        : null}
    </Card>
  );
}

function PeriodInputs({
  count,
  periods,
  setPeriods,
  blankIndex,
}: {
  count: number;
  periods: string[];
  setPeriods: (p: string[]) => void;
  blankIndex?: number;
}) {
  return (
    <View style={styles.periodRow}>
      {Array.from({ length: count }, (_, i) =>
        i === blankIndex ? null : (
          <View key={i} style={styles.flex}>
            <NumberField
              label={`Grading period ${i + 1}`}
              value={periods[i] ?? ''}
              onChangeText={(t) => setPeriods(periods.map((p, j) => (j === i ? t : p)))}
              placeholder="92"
            />
          </View>
        ),
      )}
    </View>
  );
}

function RangeResult({ label, range, unit = '%' }: { label: string; range: ScoreRange; unit?: string }) {
  const theme = useTheme();
  if (!Number.isFinite(range.estimate) || !range.plausible) {
    return (
      <Banner
        tone="warning"
        text="No score from 0 to 100 explains these numbers. The teacher probably counted another grade we can’t see, or the semester formula is different. Try the Hidden grade tab or check the formula."
      />
    );
  }
  const lo = Math.max(0, range.min);
  const hi = Math.min(100, range.max);
  return (
    <Card>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="title" style={{ color: theme.tint }}>
        {range.estimate.toFixed(1)}
        {unit}
      </ThemedText>
      {hi - lo >= 0.1 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Somewhere between {lo.toFixed(1)} and {hi.toFixed(1)}. HAC rounds grades, so this is as exact as the math can be.
        </ThemedText>
      ) : null}
    </Card>
  );
}

function parsePeriods(periods: string[], count: number, skip?: number): number[] | null {
  const values = periods.slice(0, count).map((p, i) => (i === skip ? 0 : toNumber(p)));
  return values.every((v) => v !== null) ? (values as number[]) : null;
}

// ---------- modes ----------

function BeforeFinal({ weights, periods, setPeriods }: { weights: SemesterWeights; periods: string[]; setPeriods: (p: string[]) => void }) {
  const theme = useTheme();
  const [target, setTarget] = useState('');
  const count = weights.periods.length;
  const grades = parsePeriods(periods, count);
  const noExam = normalizeWeights(weights).exam === 0;

  const rows = grades && !noExam ? [90, 80, 70, ...(toNumber(target) !== null ? [toNumber(target) as number] : [])] : [];

  return (
    <>
      <SectionHeader title="Your grading period grades" />
      <Card>
        <PeriodInputs count={count} periods={periods} setPeriods={setPeriods} />
        <NumberField label="Custom target (optional)" value={target} onChangeText={setTarget} placeholder="e.g. 95" />
      </Card>
      {noExam ? <Banner tone="warning" text="This formula has no exam weight." /> : null}
      {rows.length > 0 ? (
        <Card>
          {rows.map((t, i) => {
            const need = requiredExamScore(grades as number[], t, weights);
            const text = need <= 0 ? 'Guaranteed' : need > 100 ? `Not possible (needs ${need.toFixed(1)})` : `${need.toFixed(1)} on the final`;
            return (
              <View key={`${t}-${i}`}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={`To finish with ${t}`}
                  subtitle={t >= 90 ? 'A' : t >= 80 ? 'B' : t >= 70 ? 'C' : undefined}
                  right={<ThemedText style={{ color: need > 100 ? theme.danger : need <= 0 ? theme.success : theme.text }}>{text}</ThemedText>}
                />
              </View>
            );
          })}
          <ThemedText type="small" themeColor="textSecondary">
            Assumes HAC rounds the semester grade (89.5 shows as 90).
          </ThemedText>
        </Card>
      ) : null}
    </>
  );
}

function AfterFinal({
  weights,
  periods,
  setPeriods,
  semester,
  setSemester,
}: {
  weights: SemesterWeights;
  periods: string[];
  setPeriods: (p: string[]) => void;
  semester: string;
  setSemester: (s: string) => void;
}) {
  const [periodRounding, setPeriodRounding] = useState<Rounding>('whole');
  const count = weights.periods.length;
  const grades = parsePeriods(periods, count);
  const sem = toNumber(semester);
  const range = grades && sem !== null && normalizeWeights(weights).exam > 0 ? examScoreFromSemester(grades, sem, weights, { periodRounding }) : null;

  return (
    <>
      <SectionHeader title="What did I get on the final?" />
      <Card>
        <PeriodInputs count={count} periods={periods} setPeriods={setPeriods} />
        <NumberField label="Posted semester grade" value={semester} onChangeText={setSemester} placeholder="89" />
        <ThemedText type="small" themeColor="textSecondary">
          Grading period grades are…
        </ThemedText>
        <Segmented
          options={[
            { value: 'whole', label: 'Whole numbers (report card)' },
            { value: 'hundredth', label: 'Decimals (assignments page)' },
          ]}
          value={periodRounding}
          onChange={setPeriodRounding}
        />
      </Card>
      {range ? <RangeResult label="Your final exam score" range={range} /> : null}
    </>
  );
}

function HiddenGrade({
  weights,
  periods,
  setPeriods,
  exam,
  setExam,
  semester,
  setSemester,
  initialCourse,
  marking,
}: {
  weights: SemesterWeights;
  periods: string[];
  setPeriods: (p: string[]) => void;
  exam: string;
  setExam: (s: string) => void;
  semester: string;
  setSemester: (s: string) => void;
  initialCourse?: string;
  marking?: string;
}) {
  const [source, setSource] = useState<'average' | 'semester'>(initialCourse ? 'average' : 'semester');
  const { data } = useGrades(marking);
  const courses = data?.page.courses ?? [];
  const [courseId, setCourseId] = useState(initialCourse ?? '');
  const course = courses.find((c) => c.id === courseId);

  return (
    <>
      <Banner text="Use this when a teacher counts a grade (usually the final) in the average before it shows up. Tell us where it went and we’ll work out the score." />
      <Segmented
        options={[
          { value: 'average', label: 'From class average' },
          { value: 'semester', label: 'From semester grade' },
        ]}
        value={source}
        onChange={setSource}
      />

      <SectionHeader title="Class with the hidden grade" />
      <Card>
        {courses.map((c, i) => (
          <View key={c.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              title={c.name}
              subtitle={`Posted ${formatAverage(c.reportedAverage)}`}
              right={c.id === courseId ? <ThemedText>✓</ThemedText> : undefined}
              onPress={() => setCourseId(c.id === courseId ? '' : c.id)}
            />
          </View>
        ))}
        {source === 'semester' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Optional here: pick the class to also turn the grading period grade into the test score.
          </ThemedText>
        ) : null}
      </Card>

      {source === 'average' ? (
        course ? <HiddenFromAverage course={course} /> : null
      ) : (
        <HiddenFromSemester
          weights={weights}
          periods={periods}
          setPeriods={setPeriods}
          exam={exam}
          setExam={setExam}
          semester={semester}
          setSemester={setSemester}
          course={course}
        />
      )}
    </>
  );
}

function HiddenSpecInputs({
  course,
  category,
  setCategory,
  points,
  setPoints,
  weight,
  setWeight,
}: {
  course: Course;
  category: string;
  setCategory: (c: string) => void;
  points: string;
  setPoints: (p: string) => void;
  weight: string;
  setWeight: (w: string) => void;
}) {
  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        Which category did the hidden grade go in?
      </ThemedText>
      {course.categories.length > 0 ? (
        <Segmented options={course.categories.map((c) => ({ value: c.name, label: c.name }))} value={category} onChange={setCategory} />
      ) : null}
      <View style={styles.periodRow}>
        <View style={styles.flex}>
          <NumberField label="Worth (points)" value={points} onChangeText={setPoints} />
        </View>
        <View style={styles.flex}>
          <NumberField label="Counts as (×)" value={weight} onChangeText={setWeight} hint="Usually 1" />
        </View>
      </View>
    </>
  );
}

function HiddenFromAverage({ course }: { course: Course }) {
  const [category, setCategory] = useState(
    course.categories.find((c) => /major|test|exam|summative/i.test(c.name))?.name ?? course.categories[0]?.name ?? '',
  );
  const [points, setPoints] = useState('100');
  const [weight, setWeight] = useState('1');
  const [posted, setPosted] = useState(course.reportedAverage !== null ? String(course.reportedAverage) : '');
  const p = toNumber(posted);

  let range: ScoreRange | null = null;
  if (p !== null && category) {
    try {
      range = solveHiddenAssignment(
        course,
        { category, totalPoints: toNumber(points) ?? 100, weight: toNumber(weight) ?? 1 },
        p,
        posted.includes('.') ? 'hundredth' : 'whole',
      );
    } catch {
      range = null;
    }
  }

  return (
    <>
      <Card>
        <HiddenSpecInputs
          course={course}
          category={category}
          setCategory={setCategory}
          points={points}
          setPoints={setPoints}
          weight={weight}
          setWeight={setWeight}
        />
        <NumberField label="Posted class average" value={posted} onChangeText={setPosted} hint="Filled from HAC. Change it if you saw a different number." />
      </Card>
      {range ? <RangeResult label="The hidden grade was about" range={range} /> : null}
    </>
  );
}

function HiddenFromSemester({
  weights,
  periods,
  setPeriods,
  exam,
  setExam,
  semester,
  setSemester,
  course,
}: {
  weights: SemesterWeights;
  periods: string[];
  setPeriods: (p: string[]) => void;
  exam: string;
  setExam: (s: string) => void;
  semester: string;
  setSemester: (s: string) => void;
  course?: Course;
}) {
  const count = weights.periods.length;
  const [unknown, setUnknown] = useState(count - 1);
  const [category, setCategory] = useState(course?.categories[0]?.name ?? '');
  const [points, setPoints] = useState('100');
  const [weight, setWeight] = useState('1');

  const known = parsePeriods(periods, count, unknown);
  const sem = toNumber(semester);
  const examScore = toNumber(exam);

  let period: ScoreRange | null = null;
  if (known && sem !== null) {
    try {
      period = impliedPeriodGrade(
        known.map((g, i) => (i === unknown ? null : g)),
        sem,
        examScore,
        weights,
        { semesterRounding: 'whole', periodRounding: 'whole' },
      );
    } catch {
      period = null;
    }
  }

  // Second step: which test score inside that grading period produces that grade?
  let test: ScoreRange | null = null;
  const cat = category || course?.categories[0]?.name;
  if (period?.plausible && course && cat) {
    const spec = { category: cat, totalPoints: toNumber(points) ?? 100, weight: toNumber(weight) ?? 1 };
    try {
      const mid = solveHiddenAssignment(course, spec, period.estimate, 'none');
      const lo = solveHiddenAssignment(course, spec, period.min, 'none');
      const hi = solveHiddenAssignment(course, spec, period.max, 'none');
      test = { estimate: mid.estimate, min: lo.estimate, max: hi.estimate, plausible: mid.plausible };
    } catch {
      test = null;
    }
  }

  return (
    <>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Which grading period had the hidden grade added?
        </ThemedText>
        <Segmented
          options={Array.from({ length: count }, (_, i) => ({ value: String(i), label: `Period ${i + 1}` }))}
          value={String(unknown)}
          onChange={(v) => setUnknown(Number(v))}
        />
        <PeriodInputs count={count} periods={periods} setPeriods={setPeriods} blankIndex={unknown} />
        <NumberField label="Posted semester grade" value={semester} onChangeText={setSemester} placeholder="89" />
        <NumberField
          label="Exam grade (if it has its own column)"
          value={exam}
          onChangeText={setExam}
          hint="Leave blank if the exam was put inside the grading period."
        />
        {course ? (
          <HiddenSpecInputs
            course={course}
            category={cat ?? ''}
            setCategory={setCategory}
            points={points}
            setPoints={setPoints}
            weight={weight}
            setWeight={setWeight}
          />
        ) : null}
      </Card>
      {period ? <RangeResult label={`Grading period ${unknown + 1} must have been`} range={period} /> : null}
      {test ? <RangeResult label="So the hidden test score was about" range={test} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  periodRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
});
