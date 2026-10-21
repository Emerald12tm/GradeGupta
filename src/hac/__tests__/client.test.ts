import { HacClient, HacError } from '../client';
import { HAC_PATHS } from '../endpoints';

import * as F from './fixtures';

/**
 * A fake HAC server: routes requests by path and method, records every call, and can be
 * told to "expire" the session to exercise the re-login path.
 */
function fakeHac(options: { password?: string } = {}) {
  const calls: { path: string; method: string; body?: string }[] = [];
  let signedIn = false;
  let expireNext = false;

  const fetch = async (url: string, init: RequestInit = {}) => {
    const path = url.replace('https://hac.example.org', '');
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? init.body : undefined;
    calls.push({ path, method, body });

    const respond = (html: string) => new Response(html, { status: 200 });

    if (path === HAC_PATHS.login) {
      if (method === 'GET') return respond(F.LOGIN_PAGE);
      const form = new URLSearchParams(body);
      signedIn = form.get('LogOnDetails.Password') === (options.password ?? 'right');
      return respond(signedIn ? F.HOME_PAGE : F.LOGIN_FAILED_PAGE);
    }
    if (expireNext) {
      expireNext = false;
      signedIn = false;
    }
    if (!signedIn) return respond(F.LOGIN_PAGE);
    if (path === HAC_PATHS.assignments) {
      const run = method === 'POST' ? new URLSearchParams(body).get('ctl00$plnMain$ddlReportCardRuns') ?? '1-2026' : '1-2026';
      return respond(F.assignmentsPage(run, run === '2-2026' ? '95.00' : '80.00'));
    }
    if (path === HAC_PATHS.schedule) return respond(F.SCHEDULE_PAGE);
    return new Response('not found', { status: 404 });
  };

  return { fetch, calls, expire: () => (expireNext = true) };
}

const creds = (password = 'right') => ({ baseUrl: 'hac.example.org', username: 'student', password });

describe('HacClient', () => {
  it('logs in lazily and fetches assignments', async () => {
    const hac = fakeHac();
    const client = new HacClient(creds(), { fetch: hac.fetch });
    const page = await client.getAssignments();
    expect(page.courses[0].name).toBe('AP Physics 1');
    expect(hac.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      `GET ${HAC_PATHS.login}`,
      `POST ${HAC_PATHS.login}`,
      `GET ${HAC_PATHS.assignments}`,
    ]);
  });

  it('reports bad credentials with HAC’s message', async () => {
    const client = new HacClient(creds('wrong'), { fetch: fakeHac().fetch });
    await expect(client.login()).rejects.toMatchObject({
      code: 'bad-credentials',
      message: 'Your attempt to log in was unsuccessful.',
    });
  });

  it('re-logs in once when the session expires', async () => {
    const hac = fakeHac();
    const client = new HacClient(creds(), { fetch: hac.fetch });
    await client.getSchedule();
    hac.expire();
    const schedule = await client.getSchedule();
    expect(schedule).toHaveLength(2);
    expect(hac.calls.filter((c) => c.method === 'POST' && c.path === HAC_PATHS.login)).toHaveLength(2);
  });

  it('switches marking periods with a postback', async () => {
    const hac = fakeHac();
    const client = new HacClient(creds(), { fetch: hac.fetch });
    const page = await client.getAssignments('2-2026');
    expect(page.markingPeriods.find((p) => p.selected)?.value).toBe('2-2026');
    expect(page.courses[0].assignments[0].score).toBe(95);
    const post = hac.calls.at(-1)!;
    expect(post.method).toBe('POST');
    expect(new URLSearchParams(post.body).get('__VIEWSTATE')).toBe('vs==');
  });

  it('wraps network failures', async () => {
    const client = new HacClient(creds(), {
      fetch: async () => {
        throw new TypeError('Network request failed');
      },
    });
    await expect(client.login()).rejects.toBeInstanceOf(HacError);
    await expect(client.login()).rejects.toMatchObject({ code: 'network' });
  });

  it('rejects a site that is not HAC', async () => {
    const client = new HacClient(creds(), { fetch: async () => new Response('<html>hi</html>') });
    await expect(client.login()).rejects.toMatchObject({ code: 'unexpected-page' });
  });
});
