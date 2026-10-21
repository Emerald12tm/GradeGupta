/**
 * HAC page paths. These are the same for every district running Home Access Center;
 * only the host differs (e.g. `https://homeaccess.katyisd.org`).
 */
export const HAC_PATHS = {
  login: '/HomeAccess/Account/LogOn?ReturnUrl=%2fHomeAccess%2f',
  logout: '/HomeAccess/Account/LogOff',
  assignments: '/HomeAccess/Content/Student/Assignments.aspx',
  schedule: '/HomeAccess/Content/Student/Classes.aspx',
  transcript: '/HomeAccess/Content/Student/Transcript.aspx',
  reportCard: '/HomeAccess/Content/Student/ReportCards.aspx',
  progress: '/HomeAccess/Content/Student/InterimProgress.aspx',
  attendance: '/HomeAccess/Content/Attendance/MonthlyView.aspx',
  registration: '/HomeAccess/Content/Student/Registration.aspx',
} as const;

export type HacPage = keyof typeof HAC_PATHS;

/**
 * Turns whatever the user typed ("hac.friscoisd.org", a pasted login URL, …) into an
 * `https://host` origin. HTTPS is required because we send the password to it.
 */
export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Enter your district’s HAC address');
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error('That doesn’t look like a web address');
  }
  if (url.protocol === 'http:') url = new URL(url.href.replace(/^http:/, 'https:'));
  if (url.protocol !== 'https:') throw new Error('HAC address must start with https://');
  if (!url.hostname.includes('.')) throw new Error('That doesn’t look like a web address');
  return `https://${url.host}`;
}
