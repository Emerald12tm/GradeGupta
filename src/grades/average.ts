import type { Assignment, Category } from '@/hac/types';

/**
 * Weighted class averages, computed the way HAC does it.
 *
 * Category average = Σ(score × weight) / Σ(total × weight) × 100, over graded assignments.
 * Class average    = Σ(category average × category weight), where categories with no graded
 *                    work are skipped and the remaining weights are scaled back up to 100%.
 * A course whose categories all have weight 0 is points-based: plain earned / possible.
 */

export interface CategoryResult {
  name: string;
  /** Weight as configured in HAC (percent). */
  weight: number;
  /** Weight after redistributing empty categories, so active ones sum to 100. */
  effectiveWeight: number;
  earned: number;
  possible: number;
  /** Percent, or `null` when the category has no graded assignments. */
  average: number | null;
}

export interface AverageResult {
  average: number | null;
  categories: CategoryResult[];
}

/**
 * Counts toward averages: has a score and a non-negative point value. Extra credit
 * (worth 0 points) counts too: it adds earned points without adding possible points.
 */
export const isGraded = (a: Assignment): boolean => a.score !== null && a.totalPoints >= 0;

/** Display text for a score: "92/100", "+2.5 EC" for extra credit, "—" if ungraded. */
export function formatScore(a: Pick<Assignment, 'score' | 'totalPoints'>): string {
  if (a.score === null) return '—';
  const n = (x: number) => String(Math.round(x * 100) / 100);
  return a.totalPoints === 0 ? `+${n(a.score)} EC` : `${n(a.score)}/${n(a.totalPoints)}`;
}

/** Earned and possible points for one category, honoring HAC's per-assignment weight. */
export function categoryTotals(assignments: Assignment[], category: string) {
  let earned = 0;
  let possible = 0;
  for (const a of assignments) {
    if (a.category !== category || !isGraded(a)) continue;
    const w = a.weight ?? 1;
    earned += (a.score as number) * w;
    possible += a.totalPoints * w;
  }
  return { earned, possible, average: possible > 0 ? (earned / possible) * 100 : null };
}

export function computeAverage(categories: Category[], assignments: Assignment[]): AverageResult {
  const rows = categories.map((c) => ({ ...c, ...categoryTotals(assignments, c.name) }));
  const activeWeight = rows.reduce((sum, r) => (r.average === null ? sum : sum + r.weight), 0);

  const results: CategoryResult[] = rows.map((r) => ({
    name: r.name,
    weight: r.weight,
    effectiveWeight: r.average === null || activeWeight === 0 ? 0 : (r.weight / activeWeight) * 100,
    earned: r.earned,
    possible: r.possible,
    average: r.average,
  }));

  if (activeWeight === 0) {
    const graded = assignments.filter(isGraded);
    const possible = graded.reduce((s, a) => s + a.totalPoints * (a.weight ?? 1), 0);
    const earned = graded.reduce((s, a) => s + (a.score as number) * (a.weight ?? 1), 0);
    return { average: possible > 0 ? (earned / possible) * 100 : null, categories: results };
  }

  const average = results.reduce(
    (sum, r) => (r.average === null ? sum : sum + (r.average * r.effectiveWeight) / 100),
    0,
  );
  return { average, categories: results };
}

/**
 * Points of class average each category is costing you: (100 − category avg) × effective weight.
 * Sorted worst first. Powers the "what's hurting my grade" insight.
 */
export function categoryImpact(result: AverageResult) {
  return result.categories
    .filter((c) => c.average !== null)
    .map((c) => ({ name: c.name, pointsLost: ((100 - (c.average as number)) * c.effectiveWeight) / 100 }))
    .sort((a, b) => b.pointsLost - a.pointsLost);
}

/** Letter grade on the standard Texas scale. */
export function letterGrade(average: number | null): string {
  if (average === null) return '—';
  if (average >= 90) return 'A';
  if (average >= 80) return 'B';
  if (average >= 70) return 'C';
  return 'F';
}

/** Formats an average the way HAC does (two decimals), or a dash when there isn't one. */
export const formatAverage = (average: number | null): string =>
  average === null ? '—' : average.toFixed(2);
