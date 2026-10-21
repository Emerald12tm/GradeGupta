import { detectLevel } from '@/grades/gpa';
import type { Assignment, AssignmentsPage, Category, Course, MarkingPeriod } from '@/hac/types';

import { cleanText, lastNumber, parseHtml, parseNumber, pick, readTable, toIsoDate, type HTMLElement } from '../html';

/**
 * Parser for `Content/Student/Assignments.aspx`, the page with every class, its average,
 * its category weights and every assignment for the selected marking period.
 *
 * Page shape (simplified):
 *
 * ```html
 * <select name="ctl00$plnMain$ddlReportCardRuns"> <option selected value="1-2026">1</option> … </select>
 * <div class="AssignmentClass">
 *   <div class="sg-header">
 *     <a class="sg-header-heading">3500 - 1    AP Physics 1</a>
 *     <span class="sg-header-heading sg-right">Student Grades 93.45%</span>
 *   </div>
 *   <table id="…dgCourseAssignments_0" class="sg-asp-table">…</table>
 *   <table id="…dgCourseCategories_0" class="sg-asp-table">…</table>
 * </div>
 * ```
 */

/** Score cell values that mean "doesn't count". */
const EXCUSED = /^(X|EX|EXC|EXEMPT|I|INC|P|PENDING|NG)$/i;
/** Score cell values that mean "missing, counts as zero". */
const MISSING = /^(M|Z|MSG|MISSING)$/i;

export function parseAssignmentsPage(html: string): AssignmentsPage {
  const root = parseHtml(html);
  return {
    courses: root.querySelectorAll('.AssignmentClass').map(parseCourse),
    markingPeriods: parseMarkingPeriods(root),
  };
}

export function parseMarkingPeriods(root: HTMLElement): MarkingPeriod[] {
  const select = root.querySelector('select[name$="ddlReportCardRuns"]');
  if (!select) return [];
  return select.querySelectorAll('option').map((o) => ({
    value: o.getAttribute('value') ?? cleanText(o),
    label: cleanText(o),
    selected: o.hasAttribute('selected'),
  }));
}

/** "3500 - 1    AP Physics 1" → { code: "3500 - 1", name: "AP Physics 1" }. */
export function splitHeading(heading: string): { code: string; name: string } {
  const raw = heading.replace(/ /g, ' ').trim();
  const bySpaces = raw.split(/\s{2,}/);
  if (bySpaces.length > 1) return { code: bySpaces[0].trim(), name: bySpaces.slice(1).join(' ').trim() };
  const m = raw.match(/^(\S+\s*-\s*\S+)\s+(.+)$/);
  return m ? { code: m[1], name: m[2] } : { code: raw, name: raw };
}

function parseCourse(box: HTMLElement): Course {
  const headingEl = box.querySelector('.sg-header .sg-header-heading:not(.sg-right)') ?? box.querySelector('.sg-header-heading');
  // Keep the original spacing: the gap between code and name is how we split them.
  const { code, name } = splitHeading((headingEl?.text ?? '').replace(/ /g, ' '));

  const avgEl = box.querySelector('.sg-header .sg-right') ?? box.querySelector('[id$="lblHdrAverage"]');

  const categories: Category[] = readTable(box.querySelector('table[id*="CourseCategories"]'))
    .rows.map((r) => r.values)
    .filter((v) => v.Category && !/^total$/i.test(v.Category))
    .map((v) => ({
      name: v.Category,
      weight: parseNumber(pick(v, 'Category Weight', /weight/i)) ?? 0,
    }));

  const seen = new Map<string, number>();
  const assignments: Assignment[] = readTable(box.querySelector('table[id*="CourseAssignments"]')).rows.map(({ values: v, text }) => {
    const assignmentName = (pick(v, 'Assignment', /assignment/i) ?? '').replace(/\s*\*+$/, '').trim();
    const dateDue = toIsoDate(pick(v, 'Date Due', /due/i));
    const scoreText = (pick(v, 'Score') ?? '').trim();
    const isMissing = MISSING.test(scoreText) || Object.values(v).some((t) => /^missing$/i.test(t));
    const excused = !isMissing && (scoreText === '' || EXCUSED.test(scoreText));

    // Ids must be unique even when a teacher reuses a name on the same day.
    const baseId = `${code}|${dateDue ?? ''}|${assignmentName}`;
    const n = seen.get(baseId) ?? 0;
    seen.set(baseId, n + 1);

    return {
      id: n === 0 ? baseId : `${baseId}#${n}`,
      name: assignmentName || text,
      category: pick(v, 'Category') ?? '',
      dateDue,
      dateAssigned: toIsoDate(pick(v, 'Date Assigned', /assigned/i)),
      score: isMissing ? 0 : excused ? null : parseNumber(scoreText),
      totalPoints: parseNumber(pick(v, 'Total Points', /total p/i)) ?? 100,
      weight: parseNumber(pick(v, 'Weight')) ?? 1,
      isMissing,
    };
  });

  return {
    id: code,
    name,
    level: detectLevel(name),
    credits: 1,
    reportedAverage: lastNumber(cleanText(avgEl)),
    categories,
    assignments,
  };
}
