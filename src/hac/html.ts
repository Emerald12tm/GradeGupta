import { parse, type HTMLElement } from 'node-html-parser';

/**
 * Small HTML helpers shared by the HAC parsers.
 *
 * HAC is an ASP.NET WebForms site. Almost every grid is a `<table class="sg-asp-table">`
 * with a `tr.sg-asp-table-header-row` followed by `tr.sg-asp-table-data-row`s, and element
 * ids end in a stable suffix (e.g. `..._dgCourseAssignments_0`). The parsers match on those
 * suffixes and on header text rather than column positions, which keeps them working across
 * districts that hide or reorder columns.
 */

export type { HTMLElement };

export const parseHtml = (html: string): HTMLElement => parse(html, { comment: false });

/** Text content with non-breaking spaces turned into spaces and whitespace collapsed. */
export const cleanText = (el: HTMLElement | null | undefined): string =>
  (el?.text ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/** First number in a string ("93.45%" → 93.45), or `null`. */
export function parseNumber(s: string | undefined | null): number | null {
  const m = (s ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Last number in a string ("Student Grades 3rd 93.45" → 93.45), or `null`. */
export function lastNumber(s: string | undefined | null): number | null {
  const all = (s ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/g);
  return all ? Number(all[all.length - 1]) : null;
}

/** HAC's `MM/DD/YYYY` → ISO `YYYY-MM-DD`. Returns `undefined` for anything else. */
export function toIsoDate(s: string | undefined): string | undefined {
  const m = (s ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

export interface TableRow {
  /** Cell text keyed by header label. */
  values: Record<string, string>;
  /** Cell elements keyed by header label, for links (teacher email) or attributes. */
  cells: Record<string, HTMLElement>;
  /** Text of the whole row. */
  text: string;
}

/**
 * Reads an HAC grid into rows keyed by header text.
 * Falls back to the first `<tr>` as the header for tables without the `sg-` classes.
 */
export function readTable(table: HTMLElement | null | undefined): { headers: string[]; rows: TableRow[] } {
  if (!table) return { headers: [], rows: [] };
  const allRows = table.querySelectorAll('tr');
  const headerRow = table.querySelector('tr.sg-asp-table-header-row') ?? allRows[0];
  if (!headerRow) return { headers: [], rows: [] };

  const headers = headerRow.querySelectorAll('th, td').map((c) => cleanText(c));
  const dataRows = table.querySelectorAll('tr.sg-asp-table-data-row');
  const bodyRows = dataRows.length > 0 ? dataRows : allRows.filter((r) => r !== headerRow);

  const rows = bodyRows.map((row) => {
    const cellEls = row.querySelectorAll('td');
    const values: Record<string, string> = {};
    const cells: Record<string, HTMLElement> = {};
    headers.forEach((h, i) => {
      if (!h || !cellEls[i]) return;
      values[h] = cleanText(cellEls[i]);
      cells[h] = cellEls[i];
    });
    return { values, cells, text: cleanText(row) };
  });
  return { headers, rows };
}

/**
 * First element whose id ends with `suffix`, optionally followed by a repeater index.
 * HAC ids carry long prefixes and, inside repeaters, an index: `plnMain_rpTranscriptGroup_dgCourses_0`.
 */
export function byIdSuffix(root: HTMLElement, suffix: string, tag = '*'): HTMLElement | null {
  const pattern = new RegExp(`${suffix}(_\\d+)?$`);
  return root.querySelectorAll(`${tag}[id*="${suffix}"]`).find((el) => pattern.test(el.id)) ?? null;
}

/** Header lookup that tolerates small wording differences ("Total Points" vs "Total Pts"). */
export function pick(values: Record<string, string>, ...candidates: (string | RegExp)[]): string | undefined {
  for (const c of candidates) {
    const key = Object.keys(values).find((k) => (typeof c === 'string' ? k.toLowerCase() === c.toLowerCase() : c.test(k)));
    if (key !== undefined) return values[key];
  }
  return undefined;
}
