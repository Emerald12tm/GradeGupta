import type { Course } from '@/hac/types';

import { categoryImpact, computeAverage } from './average';
import { applyEdits, emptyEdits } from './whatif';

/**
 * Study tips computed from a class's actual numbers, so every tip says how many points
 * it's worth. No AI and nothing leaves the phone: it's arithmetic on your grades.
 */

export interface Tip {
  kind: 'missing' | 'category' | 'close' | 'upcoming';
  text: string;
  /** Points of class average at stake, used to sort tips by impact. */
  points: number;
}

const pts = (n: number) => `${n.toFixed(1)} point${Math.abs(n - 1) < 0.05 ? '' : 's'}`;

export function studyTips(course: Course, today = new Date().toISOString().slice(0, 10)): Tip[] {
  const base = computeAverage(course.categories, course.assignments);
  const current = base.average;
  if (current === null) return [];
  const tips: Tip[] = [];

  // Missing work: what turning it in at your usual level in that category would do.
  for (const a of course.assignments.filter((x) => x.isMissing && x.totalPoints > 0)) {
    const usual = base.categories.find((c) => c.name === a.category)?.average ?? 85;
    const after = computeAverage(
      course.categories,
      applyEdits(course.assignments, { ...emptyEdits(), overrides: { [a.id]: (Math.min(usual, 100) / 100) * a.totalPoints } }),
    ).average;
    if (after !== null && after - current >= 0.1) {
      tips.push({
        kind: 'missing',
        text: `Turn in “${a.name}”. Even at your usual ${Math.round(usual)}%, your average goes up ${pts(after - current)}.`,
        points: after - current,
      });
    }
  }

  // The category costing the most points.
  const worst = categoryImpact(base)[0];
  if (worst && worst.pointsLost >= 1.5 && base.categories.length > 1) {
    tips.push({
      kind: 'category',
      text: `${worst.name} costs you ${pts(worst.pointsLost)}. That’s the category to focus on.`,
      points: worst.pointsLost / 2,
    });
  }

  // Close to the next letter grade.
  const next = Math.ceil((current + 0.001) / 10) * 10;
  if (next <= 100 && next - current <= 2 && current < 90) {
    tips.push({ kind: 'close', text: `You’re ${pts(next - current)} from ${next}.`, points: next - current });
  }

  // The next big assignment: how far it can swing the average.
  const upcoming = course.assignments
    .filter((a) => a.score === null && (a.dateDue ?? '') >= today && a.totalPoints > 0)
    .sort((a, b) => (a.dateDue ?? '').localeCompare(b.dateDue ?? ''))[0];
  if (upcoming) {
    const at = (pct: number) =>
      computeAverage(course.categories, applyEdits(course.assignments, { ...emptyEdits(), overrides: { [upcoming.id]: (pct / 100) * upcoming.totalPoints } }))
        .average ?? current;
    const swing = at(100) - at(70);
    if (swing >= 0.5) {
      tips.push({
        kind: 'upcoming',
        text: `“${upcoming.name}” is coming up: a 100 vs a 70 is a ${pts(swing)} difference.`,
        points: swing / 2,
      });
    }
  }

  return tips.sort((a, b) => b.points - a.points);
}
