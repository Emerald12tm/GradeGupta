import 'server-only';
import * as cheerio from 'cheerio';
import { isIP } from 'node:net';
import type { Assignment, Category, Course, CourseLevel } from '@sg/core';

/**
 * Home Access Center scraper. HAC has no public API, so we log in like a browser and
 * parse the HTML. Layouts vary slightly by district — test against yours and adjust the
 * selectors in `parseAssignments` if needed.
 */

export class HacError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

/** Blocks SSRF: only public https hosts. */
export function normalizeBaseUrl(input: string): string {
  let u: URL;
  try {
    u = new URL(input.includes('://') ? input : `https://${input}`);
  } catch {
    throw new HacError('Invalid HAC URL', 400);
  }
  if (u.protocol !== 'https:') throw new HacError('HAC URL must use https', 400);
  if (isIP(u.hostname) || u.hostname === 'localhost' || !u.hostname.includes('.')) {
    throw new HacError('HAC URL must be a public hostname', 400);
  }
  return u.origin;
}

export class HacSession {
  private cookies = new Map<string, string>();
  private constructor(readonly baseUrl: string) {}

  static async login(baseUrl: string, username: string, password: string): Promise<HacSession> {
    const s = new HacSession(normalizeBaseUrl(baseUrl));
    const loginPath = '/HomeAccess/Account/LogOn?ReturnUrl=%2fHomeAccess%2f';
    const $ = cheerio.load(await (await s.fetch(loginPath)).text());
    const token = $('input[name="__RequestVerificationToken"]').val();
    if (!token) throw new HacError('Could not reach the HAC login page. Check the URL.');

    const form = new URLSearchParams({
      __RequestVerificationToken: String(token),
      'SCKTY00328510CustomEnabled': 'False',
      'SCKTY00436568CustomEnabled': 'False',
      Database: String($('select[name="Database"] option[selected]').val() ?? $('input[name="Database"]').val() ?? '10'),
      VerificationOption: 'UsernamePassword',
      'LogOnDetails.UserName': username,
      tempUN: '',
      tempPW: '',
      'LogOnDetails.Password': password,
    });
    const res = await s.fetch(loginPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    // Success = redirect into the portal. Failure = 200 with the login form again.
    if (res.status !== 302 && res.status !== 303) throw new HacError('Invalid HAC username or password', 401);
    return s;
  }

  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(new URL(path, this.baseUrl), {
      ...init,
      redirect: 'manual',
      headers: {
        ...init.headers,
        'User-Agent': 'Mozilla/5.0 (ShauryaGrades)',
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      signal: AbortSignal.timeout(20_000),
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair = ''] = c.split(';');
      const i = pair.indexOf('=');
      if (i > 0) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    return res;
  }

  async page(path: string) {
    const res = await this.fetch(path);
    if (res.status >= 300 && res.status < 400) throw new HacError('HAC session expired', 401);
    return cheerio.load(await res.text());
  }

  async getCourses(): Promise<Course[]> {
    return parseAssignments(await this.page('/HomeAccess/Content/Student/Assignments.aspx'));
  }

  // TODO: schedule (Classes.aspx), attendance (Attendance.aspx), report card (ReportCards.aspx),
  // transcript (Transcript.aspx), teacher emails (Classes.aspx). Same pattern as getCourses().
}

const num = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

function detectLevel(name: string): CourseLevel {
  const n = ` ${name.toUpperCase()} `;
  if (/\bAP\b/.test(n)) return 'ap';
  if (/\bIB\b/.test(n)) return 'ib';
  if (/\b(DC|DUAL)\b/.test(n)) return 'dual_credit';
  if (/\b(H|HON|HONORS|PAP|GT|ADV)\b/.test(n)) return 'honors';
  return 'regular';
}

/** Reads an HAC `sg-asp-table` into objects keyed by header text. */
function readTable($: cheerio.CheerioAPI, table: ReturnType<cheerio.CheerioAPI>) {
  const headers = table
    .find('tr.sg-asp-table-header-row')
    .first()
    .children()
    .map((_, el) => $(el).text().trim())
    .get();
  return table
    .find('tr.sg-asp-table-data-row')
    .toArray()
    .map((row) => {
      const cells = $(row).children();
      const obj: Record<string, string> = { __raw: $(row).text() };
      headers.forEach((h, i) => (obj[h] = cells.eq(i).text().trim()));
      return obj;
    });
}

export function parseAssignments($: cheerio.CheerioAPI): Course[] {
  return $('.AssignmentClass')
    .toArray()
    .map((el): Course => {
      const box = $(el);
      const heading = box.find('.sg-header .sg-header-heading').first().text().trim();
      // "1234 - 1     AP Physics 1"
      const [code = heading, ...rest] = heading.split(/\s{2,}/);
      const name = rest.join(' ').trim() || heading;

      const categories: Category[] = readTable($, box.find('table[id*="CourseCategories"]'))
        .filter((r) => r.Category && r.Category !== 'Total')
        .map((r) => ({ name: r.Category!, weight: num(r['Category Weight'] ?? '') ?? 0 }));

      const assignments: Assignment[] = readTable($, box.find('table[id*="CourseAssignments"]')).map((r, i) => {
        const scoreText = r.Score ?? '';
        const excused = /^(X|EXC|Exempt|I|Z)$/i.test(scoreText);
        const isMissing = /missing/i.test(r.__raw ?? '') || /^M$/i.test(scoreText);
        return {
          id: `${code}-${i}-${r['Assignment'] ?? ''}`,
          name: (r['Assignment'] ?? '').replace(/\s*\*+$/, ''),
          category: r.Category ?? '',
          dateDue: r['Date Due'],
          dateAssigned: r['Date Assigned'],
          score: excused ? null : isMissing ? 0 : num(scoreText),
          totalPoints: num(r['Total Points'] ?? '') ?? 100,
          weight: num(r['Weight'] ?? '') ?? 1,
          isMissing,
        };
      });

      const avgText = box.find('.sg-header .sg-header-heading.sg-right').text();
      return {
        id: code.trim(),
        name,
        level: detectLevel(name),
        credits: 1,
        reportedAverage: num(avgText),
        categories,
        assignments,
      };
    });
}
