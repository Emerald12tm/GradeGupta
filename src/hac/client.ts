import type { AssignmentsPage, AttendanceDay, HacTable, ScheduleEntry, StudentInfo, Transcript } from '@/hac/types';

import { HAC_PATHS, normalizeBaseUrl } from './endpoints';
import { parseAssignmentsPage } from './parsers/assignments';
import { buildLoginForm, buildMarkingPeriodForm, isLoginPage, loginErrorMessage } from './parsers/forms';
import {
  parseAttendance,
  parseProgressReport,
  parseReportCard,
  parseSchedule,
  parseStudentInfo,
  parseTranscript,
} from './parsers/pages';

/**
 * Talks to a district's Home Access Center directly from the phone.
 *
 * HAC has no API, so this logs in like a browser and downloads pages for the parsers.
 * Session cookies live in the operating system's cookie store, which React Native's
 * `fetch` uses automatically (`credentials: 'include'`), so they survive between requests
 * and app launches. When HAC sends us back to the login page (sessions expire after
 * ~20 minutes idle) we log in again once and retry.
 *
 * Credentials are passed in by the caller (loaded from the secure store) and never leave
 * the device except in the login request to the district's own server.
 */

export type HacErrorCode = 'bad-credentials' | 'network' | 'unexpected-page' | 'timeout';

export class HacError extends Error {
  readonly code: HacErrorCode;
  constructor(code: HacErrorCode, message: string) {
    super(message);
    this.name = 'HacError';
    this.code = code;
  }
}

export interface HacCredentials {
  /** District HAC address, any form the user typed (normalized internally). */
  baseUrl: string;
  username: string;
  password: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HacClientOptions {
  /** Injected for tests. Defaults to the global `fetch`. */
  fetch?: FetchLike;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
}

const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' };

export class HacClient {
  readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private loggedIn = false;

  constructor(credentials: HacCredentials, options: HacClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(credentials.baseUrl);
    this.username = credentials.username;
    this.password = credentials.password;
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  /** Signs in. Throws `HacError('bad-credentials')` when HAC rejects the username/password. */
  async login(): Promise<void> {
    const page = await this.request(HAC_PATHS.login);
    let body: URLSearchParams;
    try {
      body = buildLoginForm(page, this.username, this.password);
    } catch {
      throw new HacError('unexpected-page', 'Couldn’t find the HAC login page at this address.');
    }
    const result = await this.request(HAC_PATHS.login, { method: 'POST', headers: FORM_HEADERS, body: body.toString() });
    if (isLoginPage(result)) {
      throw new HacError('bad-credentials', loginErrorMessage(result) ?? 'HAC didn’t accept that username and password.');
    }
    this.loggedIn = true;
  }

  /** Ends the HAC session. Errors are ignored: signing out locally matters more. */
  async logout(): Promise<void> {
    try {
      await this.request(HAC_PATHS.logout);
    } catch {
      // ignore
    }
    this.loggedIn = false;
  }

  /**
   * Classes, averages, categories and assignments.
   * @param markingPeriod a value from `markingPeriods` to switch to; omit for HAC's default (current).
   */
  async getAssignments(markingPeriod?: string): Promise<AssignmentsPage> {
    const html = await this.page(HAC_PATHS.assignments);
    const page = parseAssignmentsPage(html);
    const current = page.markingPeriods.find((p) => p.selected)?.value;
    if (!markingPeriod || markingPeriod === current) return page;

    const body = buildMarkingPeriodForm(html, markingPeriod).toString();
    return parseAssignmentsPage(
      await this.page(HAC_PATHS.assignments, { method: 'POST', headers: FORM_HEADERS, body }),
    );
  }

  async getSchedule(): Promise<ScheduleEntry[]> {
    return parseSchedule(await this.page(HAC_PATHS.schedule));
  }

  async getTranscript(): Promise<Transcript> {
    return parseTranscript(await this.page(HAC_PATHS.transcript));
  }

  async getReportCard(): Promise<HacTable> {
    return parseReportCard(await this.page(HAC_PATHS.reportCard));
  }

  async getProgressReport(): Promise<HacTable> {
    return parseProgressReport(await this.page(HAC_PATHS.progress));
  }

  async getAttendance(): Promise<{ month: string; days: AttendanceDay[] }> {
    return parseAttendance(await this.page(HAC_PATHS.attendance));
  }

  async getStudentInfo(): Promise<StudentInfo> {
    return parseStudentInfo(await this.page(HAC_PATHS.registration));
  }

  /** Fetches a signed-in page, logging in first or again if HAC bounced us to the login form. */
  private async page(path: string, init?: RequestInit): Promise<string> {
    if (!this.loggedIn) await this.login();
    let html = await this.request(path, init);
    if (isLoginPage(html)) {
      this.loggedIn = false;
      await this.login();
      html = await this.request(path, init);
      if (isLoginPage(html)) throw new HacError('unexpected-page', 'HAC keeps signing us out. Try again later.');
    }
    return html;
  }

  /** One HTTP request with a timeout. Returns the response body as text. */
  private async request(path: string, init: RequestInit = {}): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        credentials: 'include',
        signal: controller.signal,
      });
      if (res.status >= 500) throw new HacError('network', `HAC returned an error (${res.status}).`);
      return await res.text();
    } catch (e) {
      if (e instanceof HacError) throw e;
      if (controller.signal.aborted) throw new HacError('timeout', 'HAC took too long to respond.');
      throw new HacError('network', 'Couldn’t reach HAC. Check your connection and district address.');
    } finally {
      clearTimeout(timer);
    }
  }
}
