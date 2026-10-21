import { parseHtml, type HTMLElement } from '../html';

/**
 * ASP.NET form helpers.
 *
 * HAC pages are WebForms: switching marking periods means re-posting the page with its
 * `__VIEWSTATE`, `__EVENTVALIDATION` and every other field exactly as the server sent them,
 * plus the changed dropdown. Rather than hard-coding field names (they differ between HAC
 * versions), we copy every field in the form and override only what we need.
 */

/** Every successful field in the first `<form>`: hidden/text inputs and selected options. */
export function readFormFields(root: HTMLElement): Record<string, string> {
  const form = root.querySelector('form') ?? root;
  const fields: Record<string, string> = {};

  for (const input of form.querySelectorAll('input')) {
    const name = input.getAttribute('name');
    const type = (input.getAttribute('type') ?? 'text').toLowerCase();
    if (!name || ['submit', 'button', 'image', 'reset', 'file'].includes(type)) continue;
    if ((type === 'checkbox' || type === 'radio') && !input.hasAttribute('checked')) continue;
    fields[name] = input.getAttribute('value') ?? '';
  }
  for (const select of form.querySelectorAll('select')) {
    const name = select.getAttribute('name');
    if (!name) continue;
    const options = select.querySelectorAll('option');
    const chosen = options.find((o) => o.hasAttribute('selected')) ?? options[0];
    fields[name] = chosen?.getAttribute('value') ?? '';
  }
  return fields;
}

/** True when HAC served the login page, i.e. we're not (or no longer) signed in. */
export const isLoginPage = (html: string): boolean => /LogOnDetails\.Password/.test(html);

/**
 * Builds the login POST body from the login page.
 * Keeps the anti-forgery token and the district's `Database` choice, fills in credentials.
 */
export function buildLoginForm(loginHtml: string, username: string, password: string): URLSearchParams {
  const fields = readFormFields(parseHtml(loginHtml));
  if (!fields.__RequestVerificationToken) {
    throw new Error('Login page has no verification token');
  }
  return new URLSearchParams({
    ...fields,
    VerificationOption: fields.VerificationOption || 'UsernamePassword',
    'LogOnDetails.UserName': username,
    'LogOnDetails.Password': password,
  });
}

/** Error text HAC shows on a failed login ("Your attempt to log in was unsuccessful."). */
export function loginErrorMessage(html: string): string | undefined {
  const root = parseHtml(html);
  const el = root.querySelector('.validation-summary-errors') ?? root.querySelector('.field-validation-error');
  const text = el?.text.replace(/\s+/g, ' ').trim();
  return text || undefined;
}

/**
 * POST body that asks Assignments.aspx for a different marking period: the page's own
 * fields, the chosen period, and the "Refresh View" button as the event target.
 */
export function buildMarkingPeriodForm(assignmentsHtml: string, markingPeriod: string): URLSearchParams {
  const root = parseHtml(assignmentsHtml);
  const fields = readFormFields(root);
  const dropdown = Object.keys(fields).find((k) => k.endsWith('ddlReportCardRuns'));
  if (!dropdown) throw new Error('Marking period selector not found');

  const refresh = root.querySelector('[name$="btnRefreshView"]')?.getAttribute('name') ?? 'ctl00$plnMain$btnRefreshView';
  return new URLSearchParams({
    ...fields,
    [dropdown]: markingPeriod,
    __EVENTTARGET: refresh,
    __EVENTARGUMENT: '',
  });
}
