import type { Assignment, Course } from '@/hac/types';

import { computeAverage, type AverageResult } from './average';

/**
 * "What if" mode: apply hypothetical changes to a course and recompute.
 *
 * Nothing here mutates the course; the edits are a separate overlay so the real HAC
 * data is always one tap away.
 */
export interface WhatIfEdits {
  /** Made-up assignments to add. */
  added: Assignment[];
  /** Score overrides for existing assignments, keyed by assignment id. `null` = ungraded. */
  overrides: Record<string, number | null>;
  /** Ids of existing assignments to leave out entirely. */
  dropped: string[];
}

export const emptyEdits = (): WhatIfEdits => ({ added: [], overrides: {}, dropped: [] });

export const hasEdits = (e: WhatIfEdits): boolean =>
  e.added.length > 0 || Object.keys(e.overrides).length > 0 || e.dropped.length > 0;

/** The course's assignment list with the edits applied. */
export function applyEdits(assignments: Assignment[], edits: WhatIfEdits): Assignment[] {
  const dropped = new Set(edits.dropped);
  return [
    ...assignments
      .filter((a) => !dropped.has(a.id))
      .map((a) => (a.id in edits.overrides ? { ...a, score: edits.overrides[a.id], isMissing: false } : a)),
    ...edits.added.map((a) => ({ ...a, isMock: true })),
  ];
}

export interface WhatIfResult extends AverageResult {
  /** Average before edits (HAC's reported average when available). */
  before: number | null;
  /** Change caused by the edits, in percentage points. */
  delta: number | null;
}

export function whatIf(course: Course, edits: WhatIfEdits): WhatIfResult {
  const before = course.reportedAverage ?? computeAverage(course.categories, course.assignments).average;
  const after = computeAverage(course.categories, applyEdits(course.assignments, edits));
  return {
    ...after,
    before,
    delta: before !== null && after.average !== null ? after.average - before : null,
  };
}
